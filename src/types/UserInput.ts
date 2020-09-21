import { Field, InputType } from "type-graphql";

// Arguments of mutations

@InputType()
export class UserInput {
  @Field()
  username: string;
  @Field()
  password: string;
  @Field()
  email: string;
}
