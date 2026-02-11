-- Create user cred table
CREATE TABLE `user_creds` (
  `uid` int NOT NULL AUTO_INCREMENT,
  `username` varchar(45) NOT NULL,
  `md5_pass` char(32) NOT NULL,
  PRIMARY KEY (`uid`),
  UNIQUE KEY `uid_UNIQUE` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create auth log DB
CREATE TABLE `auth_log` (
  `iid` int NOT NULL AUTO_INCREMENT,
  `user` varchar(45) DEFAULT NULL,
  `logtime` datetime NOT NULL,
  `success` tinyint NOT NULL,
  PRIMARY KEY (`iid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;