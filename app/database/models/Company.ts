// models/Company.ts
import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Company extends Model {
  static table = "companies";

  @field("label") label!: string;
  @field("value") value!: string;
}
