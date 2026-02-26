CREATE DATABASE IF NOT EXISTS logsnatch;
USE logsnatch;

CREATE TABLE IF NOT EXISTS user_creds (
    uid INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    md5_pass VARCHAR(32) NOT NULL, -- MD5 hashes are always 32 characters
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE `auth_log` (
  `iid` int NOT NULL AUTO_INCREMENT,
  `user` varchar(45) DEFAULT NULL,
  `logtime` datetime NOT NULL,
  `success` tinyint NOT NULL,
  PRIMARY KEY (`iid`);


-- FK references the logged in user by their uid
CREATE TABLE `scan_results` (
  `scanID` int NOT NULL AUTO_INCREMENT,
  `scanDateTIme` datetime NOT NULL,
  `scanPass` tinyint NOT NULL,
  `scanRtkitID` int DEFAULT NULL,
  `scanUser` int NOT NULL,
  PRIMARY KEY (`scanID`),
  UNIQUE KEY `scanID_UNIQUE` (`scanID`),
  KEY `fk_scanuser_idx` (`scanUser`),
  CONSTRAINT `fk_scanuser` FOREIGN KEY (`scanUser`) REFERENCES `user_creds` (`uid`);

-- FK references scanID in results; we tie multiple results (all of these entries are sec violations) to one scanID
CREATE TABLE `results_rtkit` (
  `rID` int NOT NULL,
  `scanID` int DEFAULT NULL,
  `rtkitInfectedProgram` varchar(255) NOT NULL,
  `rtkitLogLocation` varchar(255) NOT NULL,
  PRIMARY KEY (`rID`),
  UNIQUE KEY `scanID_UNIQUE` (`rID`),
  KEY `fk_scanid_idx` (`scanID`),
  CONSTRAINT `fk_scanid` FOREIGN KEY (`scanID`) REFERENCES `scan_results` (`scanID`);



