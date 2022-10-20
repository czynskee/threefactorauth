# Three-factor authentication

Multi-factor authentication (MFA) adds a lot of extra security to the classic username+password login. There are many methods of secure MFA, such as hardware keys, OTP, or SMS to name a few. Unfortunately, many services unfortunately support SMS, which is not only insecure but also inconvenient. This app aims to improve the convenience of receiving these SMS codes by allowing users to receive SMS messages through a web app. While this app does not increase security of the method, it does increase convenience, especially when needing to share these tokens across a team of people.

# How it works

Each user can sign into the app using Google SSO. Upon first login, the user is assigned a phone number, and they will be able to receive messages at that phone number immediately. When a text message is received at that number, it will be displayed in the web app. Optionally, the user can also forward these messages to another phone number.

# Sharing across teams

A user can add another user by their email address, which the receiver can then accept or reject. If the share request is accepted, the receiver will also be able to see messages from the sharer. This access can also be revoked any time by either party.

# Prerequisites

- Node (tested with v18)
- PostgreSQL server
- [SignalWire space](https://developer.signalwire.com/guides/signing-up-for-a-space/)
- [Google OAuth client](https://support.google.com/cloud/answer/6158849)

# Running the app

- Install dependencies with `yarn`.
- Create a `.env` file at the root of the repository following `.env.example`.
- Run `bin/serve`.
