# CS499 - LogSnatch

- LogSnatch will analyze a variety of log sources and files to detect patterns and
  signatures that indicate system compromises and intrusions, as well as lapses in
  security posture, such as permitting root logons over SSH. The application will present these security violations to the user via the GUI dashboard.

## Build Steps

`sudo systemctl start mysql`


`mysql -u root -p`


`CREATE DATABASE IF NOT EXISTS logsnatch;`


`exit;`

`mysql -u root -p < db_struct/user_credDB.sql`

### For this part, keep 3 terminal windows open
#### First window:

`cd nodejs/backend`

`npm install`

`node server.js`

#### Second window:

`cd nodejs/frontend`

`npm install`

`npm start`

#### Third window:

`cd logsnatch-dashboard`

`npm install`

`npm start`

*Access the login page by going to localhost:3000*