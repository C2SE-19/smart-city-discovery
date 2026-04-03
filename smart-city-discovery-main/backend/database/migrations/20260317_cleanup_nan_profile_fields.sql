-- Cleanup literal 'NaN' strings in user profile fields only.
UPDATE users SET phone = NULL WHERE phone = 'NaN';
UPDATE users SET birth_date = NULL WHERE birth_date = 'NaN';
UPDATE users SET address = NULL WHERE address = 'NaN';
UPDATE users SET gender = NULL WHERE gender = 'NaN';
UPDATE users SET bio = NULL WHERE bio = 'NaN';
