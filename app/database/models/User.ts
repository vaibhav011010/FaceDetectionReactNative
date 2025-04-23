import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class User extends Model {
  static table = "users";

  @field("user_id") userId!: number;
  @field("email") email!: string;
  @field("corporate_park_id") corporateParkId!: number;
  @field("corporate_park_name") corporateParkName!: string;
  @field("role_id") roleId!: number;
  @field("role_name") roleName!: string;
  @field("permissions") permissions!: string;
  @field("access_token") accessToken!: string;
  @field("refresh_token") refreshToken!: string;
  @field("is_logged_in") isLoggedIn!: boolean;
  @field("is_first_login") isFirstLogin!: boolean; // Add this field
  @field("needs_password_change") needsPasswordChange!: boolean; // Add this new field
}
