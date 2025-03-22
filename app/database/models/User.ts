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
}
