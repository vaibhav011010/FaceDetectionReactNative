import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class LogModel extends Model {
  static table = "logs";

  @field("level") level!: string;
  @field("message") message!: string;
  @field("timestamp") timestamp!: string;
  @field("metadata") metadata!: string;
  @field("synced") synced!: boolean;
}
