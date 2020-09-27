import { isAuth } from "../middlewares/isAuth";
import { MyContext } from "src/types";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { Post } from "../entities/Post";
import { getConnection } from "typeorm";
import { Updoot } from "../entities/Updoot";

@InputType()
class PostInput {
  @Field()
  title: string;
  @Field()
  text: string;
}

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts: Post[];
  @Field()
  hasMore: boolean;
}

@Resolver(Post)
export class PostResolver {
  @FieldResolver(() => String)
  textSnippet(@Root() root: Post) {
    return root.text.slice(0, 70);
  }

  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async createPost(
    @Arg("input") input: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<Post | undefined> {
    return Post.create({ ...input, creatorId: req.session.userId }).save();
  }

  @Query(() => PaginatedPosts)
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null,
    @Ctx() { req }: MyContext
  ): Promise<PaginatedPosts> {
    const realLimit = Math.min(50, limit);

    const parameters: any[] = [realLimit + 1];

    if (req.session.userId) {
      parameters.push(req.session.userId);
    }

    // realLimit, userId?, cursor
    let cursorIndex = 3;
    if (cursor) {
      parameters.push(new Date(parseInt(cursor)));
      cursorIndex = parameters.length;
    }

    const posts = await getConnection().query(
      `
        select p.*, json_build_object(
          'id', u.id,
          'username', u.username,
          'email' , u.email,
          'createdAt', u."createdAt",
          'updatedAt', u."updatedAt"
          ) creator,
        ${
          req.session.userId
            ? '(select value from updoot where "userId" = $2 and "postId" = p.id) "voteStatus"'
            : 'null as "voteStatus"'
        }
        from post p, public.user u
        where p."creatorId" = u.id
        ${cursor ? `and p."createdAt" < $${cursorIndex}` : ""}
        order by p."createdAt" DESC
        limit $1
      `,
      parameters
    );

    return {
      posts: posts.slice(0, realLimit),
      hasMore: posts.length === realLimit + 1,
    };
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async vote(
    @Arg("postId", () => Int) postId: number,
    @Arg("value", () => Int) value: number,
    @Ctx() { req }: MyContext
  ) {
    const isUpdoot = value !== -1;
    const realValue = isUpdoot ? 1 : -1;
    const { userId } = req.session;

    const updoot = await Updoot.findOne({ where: { postId, userId } });

    console.log("updoot value", updoot?.value);
    console.log("real value", realValue);
    // User is already voted on the post
    // But they are changing
    if (updoot && updoot.value !== realValue) {
      await getConnection().transaction(async (tm) => {
        await tm.query(
          `
          update updoot
          set value = $1
          where "postId" = $2 and "userId" = $3;
        `,
          [realValue, postId, userId]
        );

        await tm.query(
          `
          update post
          set points = points + $1
          where id = $2;
        `,
          [realValue * 2, postId]
        );
      });
    } else if (!updoot) {
      // never vote before
      await getConnection().transaction(async (tm) => {
        // Insert
        await tm.query(
          `
          insert into updoot ("userId", "postId", value)
          values ($1, $2, $3);
        `,
          [userId, postId, realValue]
        );

        // Update
        await tm.query(
          `
          update post
          set points = points + $1
          where id = $2;
        `,
          [realValue, postId]
        );
      });
    }

    return true;
  }

  @Query(() => Post, { nullable: true })
  async post(@Arg("id", () => Int) id: number): Promise<Post | undefined> {
    return Post.findOne(id, { relations: ["creator"] });
  }

  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg("id") id: number,
    @Arg("title") title: string
  ): Promise<Post | null> {
    const post = await Post.findOne(id);

    if (!post) {
      return null;
    }

    if (typeof title !== "undefined") {
      post.title = title;
      await Post.update({ id }, { title });
    }

    return post;
  }

  @Mutation(() => Boolean)
  async deletePost(@Arg("id") id: number): Promise<boolean> {
    await Post.delete(id);

    return true;
  }
}
