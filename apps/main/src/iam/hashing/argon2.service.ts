import { Injectable } from "@nestjs/common";
import { hash, verify as compare } from "argon2";

import { HashingService } from "./hashing.service.js";

@Injectable()
export class Argon2Service implements HashingService {
  hash(password: string): Promise<string> {
    return hash(password);
  }

  compare(password: string, hash: string): Promise<boolean> {
    return compare(hash, password);
  }
}
