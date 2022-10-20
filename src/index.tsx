import fs from "fs";
import Koa from "koa";
import session from "koa-session";
import Router from "koa-router";
// import * as serve from 'koa-static';
import Purview from "purview";
import { App } from "./app";
import {
  BASE_URL,
  SESSION_SECRET,
  SIGNALWIRE_API_TOKEN,
  SIGNALWIRE_CONTEXT,
  SIGNALWIRE_PROJECT_ID,
} from "./constants";
import { authRoutes, AUTH_PREFIX } from "./routes/auth";
import { Messaging } from "@signalwire/realtime-api";
import { prismaClient } from "./prisma";
import EventEmitter from "eventemitter3";
import { MessageContract } from "@signalwire/realtime-api/dist/realtime-api/src/messaging/Message";

export const BAD_REQUEST = 400;
export const SHARE_REQUEST_EVENT = "share-request-event-";
export const NEW_MESSAGE_EVENT = "new-message-event-";
export const VALIDATION_CODE_EVENT = "validation-code-event-";
export const messageEventEmitter = new EventEmitter();
export const messagingClient = new Messaging.Client({
  project: SIGNALWIRE_PROJECT_ID,
  token: SIGNALWIRE_API_TOKEN,
  contexts: [SIGNALWIRE_CONTEXT],
});
const PORT = 9000;
const SESSION_CONFIG: Partial<session.opts> = {
  key: "threefactorauthSession",
  maxAge: "session",
};

const app = new Koa();
app.keys = [SESSION_SECRET];

app.use(session(SESSION_CONFIG, app));
app.use(authRoutes);

const router = new Router();
router.get("/", async (ctx) => {
  const user = ctx.session!.user;

  if (!user) {
    ctx.redirect(BASE_URL + AUTH_PREFIX);
    return;
  }

  const appHTML = await Purview.render(<App user_id={user.id} />, ctx.req);
  const styleHTML = await Purview.renderCSS(ctx.req);

  ctx.body = `
  <html>
    <head>
      <title>Three-Factor Authentication</title>
      <style>
        body {
          margin: 0;
          font-family: Roboto, Helvetica, sans-serif;
          background: rgba(130, 146, 152, .2);
        }
      </style>
      ${styleHTML}
    </head>
    <body>
      ${appHTML}
      <script src="http://localhost:8080/main.js"></script>
      <script src="http://localhost:8080/purview.js"></script>
    </body>
  </html>
  `;
});

router.get("/favicon.ico", async (ctx) => {
  const src = fs.createReadStream("./favicon.png");
  ctx.body = src;
});

app.use(router.routes());

async function startMessagingClient() {
  messagingClient.on("message.received", async (message: MessageContract) => {
    const from = message.from.substring(1);
    const to = message.to.substring(1);
    const telephone = await prismaClient.telephone.findFirst({
      where: { number: to },
    });

    if (!telephone) {
      console.log("We got a text from a number we don't have in our database");
      return;
    }

    const { body } = message;
    const validationCode = await prismaClient.validationCode.findFirst({
      where: {
        forwarding_number: from,
      },
    });

    if (validationCode) {
      // Don't create messages for validation codes
      const user = (await prismaClient.user.findFirst({
        where: { id: validationCode.user_id },
      }))!;
      messageEventEmitter.emit(VALIDATION_CODE_EVENT + String(user.id), body);
    } else {
      const user = (await prismaClient.user.findFirst({
        where: { id: telephone.user_id },
      }))!;
      if (user.forwarding_number) {
        await messagingClient.send({
          context: SIGNALWIRE_CONTEXT,
          from: "+" + telephone.number,
          to: "+" + user.forwarding_number,
          body,
        });
      }
      await prismaClient.message.create({
        data: { body, telephone_id: telephone.id, from },
      });
      messageEventEmitter.emit(NEW_MESSAGE_EVENT + String(telephone.id));
    }
  });
}

void startMessagingClient();
void startServer();

async function startServer() {
  const server = app.listen(PORT, () =>
    console.log(`Server is listening on port ${PORT}`)
  );
  Purview.handleWebSocket(server, {
    origin: `http://localhost:${PORT}`,
  });
}
