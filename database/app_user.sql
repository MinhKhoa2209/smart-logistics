\set ON_ERROR_STOP on

CREATE TEMP TABLE app_role_config (
  role_name text NOT NULL,
  role_password text NOT NULL
);

INSERT INTO app_role_config (role_name, role_password)
VALUES (:'app_user', :'app_password');

DO $$
DECLARE
  role_name text;
  role_password text;
BEGIN
  SELECT c.role_name, c.role_password
  INTO role_name, role_password
  FROM app_role_config c;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', role_name, role_password);
  ELSE
    EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', role_name, role_password);
  END IF;
END
$$;

DO $$
DECLARE
  role_name text;
BEGIN
  SELECT c.role_name
  INTO role_name
  FROM app_role_config c;

  EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), role_name);
  EXECUTE format('GRANT USAGE, CREATE ON SCHEMA public TO %I', role_name);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON ALL TABLES IN SCHEMA public TO %I', role_name);
  EXECUTE format('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO %I', role_name);
  EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO %I', role_name);
END
$$;

DROP TABLE app_role_config;
