# PostgreSQL Setup Manual for Flux Share

Since you requested PostgreSQL instead of SQLite, you will need to have a Postgres server running locally to test the API. 
Here is how you can set it up, get it running, and connect it to your app.

---

## 1. Install PostgreSQL Locally

### Option A: Install via EnterpriseDB (Recommended for Windows)
1. Download the Postgres installer: https://www.postgresql.org/download/windows/
2. Run the installer and during setup:
   - Accept the default port `5432`
   - Set the `postgres` superuser password to `password` (if you choose something else, see step 3).
3. Open `pgAdmin` (which installs alongside it), OR open `SQL Shell (psql)`.
4. Create the `flux_share` database by running:
   `CREATE DATABASE flux_share;`

### Option B: Use Docker (If you prefer containers)
Run this single command in your terminal if you have Docker configured:
`docker run --name flux-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=flux_share -p 5432:5432 -d postgres`

---

## 2. Setting Environment Variables

The application backend now looks for a `DATABASE_URL` environment variable. But it will fallback to:
`postgresql://postgres:password@localhost/flux_share`

- **postgres**: Usually the default username
- **password**: The password you set during installation
- **localhost**: Your local machine
- **flux_share**: The name of the database you newly created

**If your password is different**, you can start your backend Server like this:
*(in powershell)*
`$env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost/flux_share"`
`uvicorn main:app --reload`

Once the database is running and uvicorn boots up, SQLAlchemy will automatically detect the database and create the `users` tables inside of it exactly like it did for SQLite!
