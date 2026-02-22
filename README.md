# CS499 - LogSnatch

- LogSnatch will analyze a variety of log sources and files to detect patterns and
  signatures that indicate system compromises and intrusions, as well as lapses in
  security posture, such as permitting root logons over SSH. The application will present these security violations to the user via the GUI dashboard.

## Build Steps

1. Run SQL script in db_struct and start the DB on port 3306
2. In frontend, run:
  1. `npm install craco`
  2. `npm run build`
  3. `npm run start`
3. In backend, run:
  1. `npm install cors express mysql2 crypto`
  2. `node server.js`
