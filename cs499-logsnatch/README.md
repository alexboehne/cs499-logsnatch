# CS499 - LogSnatch

- LogSnatch will analyze a variety of log sources and files to detect patterns and
  signatures that indicate system compromises and intrusions, as well as lapses in
  security posture, such as permitting root logons over SSH. The application will present these security violations to the user via the GUI dashboard.

## Build Steps
Run SQL script in db_struct and start the DB on port 3306
In frontend, run:

`npm install craco`

`npm run build`

`npm run start`

In backend, run:

`npm install cors express mysql2 crypto`

`node server.js`
