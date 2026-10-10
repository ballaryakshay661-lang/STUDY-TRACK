# Models

`User.js` stores a required display name, normalized unique email address, and
bcrypt password hash. Password hashes are excluded from ordinary queries and
are never included in API responses.
