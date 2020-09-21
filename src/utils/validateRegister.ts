import { FieldError } from "src/types/FieldError";
import { UserInput } from "src/types/UserInput";

export const validateRegister = (options: UserInput) => {
  // SIMPLE VALIDATIONS
  const errors: FieldError[] = [];

  if (options.username.trim().length < 5) {
    errors.push({
      field: "username",
      message: "Username length must be at least 5 characters",
    });
  }

  if (options.username.includes("@")) {
    errors.push({
      field: "username",
      message: "Username cannot have '@' character",
    });
  }

  if (options.password.trim().length < 5) {
    errors.push({
      field: "password",
      message: "Password length must be at least 5 characters",
    });
  }

  if (!options.email.includes("@")) {
    errors.push({
      field: "email",
      message: "Please enter the email correctly",
    });
  }

  return errors;
};
