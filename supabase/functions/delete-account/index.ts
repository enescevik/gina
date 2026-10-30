import { deleteAccount } from "./handler.ts";

Deno.serve(req => deleteAccount(req));
