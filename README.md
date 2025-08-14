# Woovi Leaky Bucket Challenge

This challenge has as focus on implementing a leaky bucket strategy similar to the leaky bucket from BACEN.

## Deliverables
- [ ] A node js http server
- [ ] A multi-tenancy strategy to be the owner of requests. For example, you could have users, and each user will have 10 tokens
- [ ] Implement an authentication of users with a Bearer Token
- [ ] This token must be sent in the request Authorization
- [ ] A mutation that simulates a query of a pix key
- [ ] A leaky bucket strategy completed

## To-do

- [x] Implement a middleware to intercept all incoming client requests and verify if the client has sufficient tokens to proceed
- [x] If sufficient tokens are available, forward the request without modifying the token count
- [x] If insifficient tokens are available, respond with HTTP 429 (Too Many Requests) and decrement the client's token count by one
- [x] Implement a method to handle the race condition to manipulate data on redis
- [x] Get the Authorization Bearer Token
- [x] Manipulate the authoriation to get only the token of Bearer
- [x] Get the user from redis the Bearer code as key to get the quantity of tokens available to that client or create a new redis record 
- [x] If token_count is equal to zero, return HTTP 429, otherwise proceed the req
- [x] If the request is successfuly, it keeps the token count and update the timestamp
- [x] If failed it must decrease one token from tokens and update the timestamp
- [x] We need to save on redis the Bearer Token as key and a json with token_counts and timestamp of the last client's request as value
- [ ] Implement the function to verify how many time has passed after the last client request
- [ ] The new quantity of tokens will be the current user tokens plus the diff between the last update and now. And save this value if are less than or equals to 10