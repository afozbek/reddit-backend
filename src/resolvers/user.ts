import { User } from "./../entities/User";
import { MyContext } from "src/types";
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from "type-graphql";

import argon2 from "argon2";

// Arguments of mutations
@InputType()
class UsernamePasswordInput {
  @Field()
  username: string;
  @Field()
  password: string;
}

@ObjectType()
class FieldError {
  @Field()
  field: string;

  @Field()
  message: string;
}

// Return from mutations
@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver()
export class UserResolver {
  @Query(() => User, { nullable: true })
  async me(@Ctx() { em, req }: MyContext): Promise<User | null> {
    const id = req.session.userId;
    if (!id) {
      return null;
    }

    const user = await em.findOne(User, { id });

    return user;
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const errors: FieldError[] = [];
    if (options.username.trim().length < 5) {
      errors.push({
        field: "username",
        message: "Username length must be at least 5 characters",
      });
    }

    if (options.password.trim().length < 5) {
      errors.push({
        field: "password",
        message: "Password length must be at least 5 characters",
      });
    }

    const hashedPassword = await argon2.hash(options.password);

    const user = em.create(User, {
      username: options.username,
      password: hashedPassword,
    });

    try {
      await em.persistAndFlush(user);
    } catch (err: any) {
      if (err.code === "23505") {
        errors.push({
          field: "username",
          message: "Username already exists",
        });
      } else {
        throw new Error(err);
      }

      em.clear();
    }

    if (errors.length > 0) {
      return { errors };
    } else {
      req.session.userId = user.id;
      return { user };
    }
  }

  @Mutation(() => UserResponse, { nullable: true })
  async login(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(User, { username: options.username });

    if (!user) {
      return {
        errors: [
          {
            field: "username",
            message: "that username doesnt exist",
          },
        ],
      };
    }

    const validPassword = await argon2.verify(user.password, options.password);

    if (!validPassword) {
      return {
        errors: [
          {
            field: "password",
            message: "password is wrong",
          },
        ],
      };
    }

    req.session.userId = user.id;

    return { user };
  }
}
