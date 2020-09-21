import { User } from "./../entities/User";
import { MyContext } from "src/types";
import {
  Arg,
  Ctx,
  Field,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from "type-graphql";

import argon2 from "argon2";
import { __SESSION_COOKIE_NAME__ } from "../constants";
import { UserInput } from "../types/UserInput";
import { validateRegister } from "./../utils/validateRegister";
import { FieldError } from "../types/FieldError";

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
  @Mutation(() => Boolean)
  async forgotPassword(@Arg("email") email: string, @Ctx() { em }: MyContext) {
    const user = await em.findOne(User, { email });
    return true;
  }

  @Query(() => User, { nullable: true })
  async me(@Ctx() { em, req }: MyContext): Promise<User | null> {
    const id = req.session.userId;
    if (!id) {
      return null;
    }

    const user = await em.findOne(User, { id });

    return user;
  }

  @Query(() => [User])
  users(@Ctx() { em }: MyContext): Promise<User[]> {
    return em.find(User, {});
  }

  @Query(() => User, { nullable: true })
  user(@Arg("id") id: number, @Ctx() { em }: MyContext): Promise<User | null> {
    return em.findOne(User, { id });
  }

  @Mutation(() => Boolean)
  async deleteUser(
    @Arg("id") id: number,
    @Ctx() { em }: MyContext
  ): Promise<boolean> {
    await em.nativeDelete(User, { id });

    return true;
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UserInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const errors = validateRegister(options);

    if (errors.length > 0) {
      return { errors };
    }

    const hashedPassword = await argon2.hash(options.password);

    const user = em.create(User, {
      username: options.username,
      password: hashedPassword,
      email: options.email,
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

  @Mutation(() => UserResponse)
  async login(
    @Arg("usernameOrEmail") usernameOrEmail: string,
    @Arg("password") password: string,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(
      User,
      usernameOrEmail.includes("@")
        ? { email: usernameOrEmail }
        : { username: usernameOrEmail }
    );

    if (!user) {
      return {
        errors: [
          {
            field: "usernameOrEmail",
            message: "that username does not exist",
          },
        ],
      };
    }

    const validPassword = await argon2.verify(user.password, password);

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

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        if (err) {
          console.log("Logout Session Error:", err);
          resolve(false);

          return;
        }

        res.clearCookie(__SESSION_COOKIE_NAME__);
        resolve(true);
      })
    );
  }
}
