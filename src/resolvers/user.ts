import { User } from "./../entities/User";
import { MyContext } from "src/types";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
} from "type-graphql";

import argon2 from "argon2";
import {
  __FORGET_PASSWORD_PREFIX__,
  __SESSION_COOKIE_NAME__,
} from "../constants";
import { UserInput } from "../types/UserInput";
import { validateRegister } from "./../utils/validateRegister";
import { FieldError } from "../types/FieldError";
import { sendEmail } from "./../utils/sendEmail";

import { v4 } from "uuid";

// Return from mutations
@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
}

const errorGenerate = (err: FieldError) => {
  const errObj: UserResponse = { errors: [err] };
  return errObj;
};

@Resolver(User)
export class UserResolver {
  @FieldResolver(() => String)
  email(@Root() user: User, @Ctx() { req }: MyContext) {
    if (req.session.userId === user.id) {
      return user.email;
    }

    // current user wants to see other emails
    return "";
  }

  @Query(() => User, { nullable: true })
  me(@Ctx() { req }: MyContext) {
    const id = req.session.userId;
    if (!id) {
      return null;
    }

    return User.findOne(id);
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg("usernameOrEmail") usernameOrEmail: string,
    @Arg("password") password: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const user = await User.findOne({
      where: usernameOrEmail.includes("@")
        ? {
            email: usernameOrEmail,
          }
        : { username: usernameOrEmail },
    });

    if (!user) {
      return errorGenerate({
        field: "usernameOrEmail",
        message: "that username does not exist",
      });
    }

    const validPassword = await argon2.verify(user.password, password);

    if (!validPassword) {
      return errorGenerate({ field: "password", message: "password is wrong" });
    }

    req.session.userId = user.id;

    return { user };
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UserInput,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const errors = validateRegister(options);

    if (errors.length > 0) {
      return { errors };
    }

    const hashedPassword = await argon2.hash(options.password);

    const user = User.create({
      username: options.username,
      password: hashedPassword,
      email: options.email,
    });
    try {
      await user.save();
    } catch (err: any) {
      console.log(err);
      if (err.code === "23505") {
        errors.push({
          field: "username",
          message: "Username/Email already exists",
        });
      } else {
        throw new Error(err);
      }
    }

    if (errors.length > 0) {
      return { errors };
    } else {
      console.log(user);
      req.session.userId = user.id;
      return { user };
    }
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

  @Mutation(() => UserResponse)
  async changePassword(
    @Arg("newPassword") newPassword: string,
    @Arg("passwordToken") passwordToken: string,
    @Ctx() { req, redis }: MyContext
  ): Promise<UserResponse> {
    if (newPassword.trim().length < 5) {
      return errorGenerate({
        field: "newPassword",
        message: "New password must be longer than 5 characters",
      });
    }

    const redisKey = __FORGET_PASSWORD_PREFIX__ + passwordToken;
    const userId = await redis.get(redisKey);

    if (!userId) {
      return errorGenerate({ field: "token", message: "Token is expired" });
    }

    const newUserId = parseInt(userId);

    const user = await User.findOne(newUserId);

    if (!user) {
      return errorGenerate({ field: "token", message: "User no longer exist" });
    }

    await User.update(
      { id: newUserId },
      { password: await argon2.hash(newPassword) }
    );

    await redis.del(redisKey);

    // log in user after change password
    req.session.userId = user.id;

    return { user };
  }

  @Mutation(() => Boolean)
  async forgotPassword(
    @Arg("email") email: string,
    @Ctx() { redis }: MyContext
  ) {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return false;
    }

    const paswordToken = v4();
    const expirationTime = 1000 * 60 * 60 * 24 * 2; // 2 days
    console.log(__FORGET_PASSWORD_PREFIX__ + paswordToken);

    await redis.set(
      __FORGET_PASSWORD_PREFIX__ + paswordToken,
      user.id,
      "ex",
      expirationTime
    );
    const html = `<a href="${process.env.CORS_ORIGIN}/change-password/${paswordToken}">reset password</a>`;
    await sendEmail(email, html, "Forgot Password");

    return true;
  }

  @Query(() => [User])
  users(): Promise<User[]> {
    return User.find();
  }

  @Query(() => User, { nullable: true })
  user(@Arg("id") id: number): Promise<User | undefined> {
    return User.findOne(id);
  }

  @Mutation(() => Boolean)
  async deleteUser(@Arg("id") id: number): Promise<boolean> {
    await User.delete(id);

    return true;
  }
}
