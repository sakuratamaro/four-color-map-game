"use strict";
// Isolated PostgreSQL/WASM only. No URL, socket, credentials or persistent dataDir.
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const { PGlite } = createRequire(path.join(__dirname,"../sql-runtime/package.json"))("@electric-sql/pglite");
const root = path.join(__dirname,"../..");
const migrationName = "202609130001_standard_cpu_split_rescue.sql";
async function createCpuSqlDatabase({ targetMigration = migrationName } = {}) {
  if (![migrationName, "202609130002_standard_cpu_palette_efficiency.sql"].includes(targetMigration)) throw new TypeError("UNKNOWN_CPU_SQL_FIXTURE");
  const db = new PGlite();
  try {
    // Supabase platform fixtures, not a claim of testing its auth/pgcrypto service.
    // SQL digest uses PostgreSQL's actual SHA256, preserving jsonb::text hashing.
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create schema extensions;
      create function extensions.digest(value text, algorithm text) returns bytea language sql immutable as
        $$ select case when algorithm='sha256' then pg_catalog.sha256(convert_to(value,'UTF8')) else null end $$;
      create function extensions.gen_random_uuid() returns uuid language sql volatile as
        $$ select pg_catalog.gen_random_uuid() $$;
      create function extensions.gen_random_bytes(length integer) returns bytea language sql volatile as
        $$ select substring(uuid_send(pg_catalog.gen_random_uuid()) from 1 for length) $$;
      create publication supabase_realtime;
    `);
    const directory=path.join(root,"supabase/migrations");
    const baseline=fs.readdirSync(directory).filter(name=>name.endsWith(".sql")&&name<targetMigration).sort();
    for(const name of baseline){
      let sql=fs.readFileSync(path.join(directory,name),"utf8");
      // PGlite has no pgcrypto extension; only its platform registration is replaced.
      // Every application DDL/function/trigger/RLS/ACL statement stays unchanged.
      sql=sql.replace(/^create extension if not exists pgcrypto with schema extensions;\r?\n/m,"");
      try {await db.exec(sql);} catch(error){error.message=name+": "+error.message;throw error;}
    }
    return {db,baseline,migration:fs.readFileSync(path.join(directory,targetMigration),"utf8")};
  }catch(error){await db.close();throw error;}
}
module.exports={createCpuSqlDatabase,migrationName};
