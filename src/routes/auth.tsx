import axios from "axios";
import Purview from "purview";
import ClientOAuth2 = require("client-oauth2");
import { v4 as uuid } from "uuid";
import Router from "koa-router";
import {
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  BASE_URL,
} from "../constants";
import { SCOPES, Login } from "../login";
import { prismaClient } from "../prisma";
import SignalWireREST from "../services/SignalWireREST";

export const AUTH_PREFIX = "/auth";
export const BAD_REQUEST = 400;

export enum AuthPaths {
  LOGOUT = "/logout",
  OAUTH_CALLBACK = "/oauth_callback",
}
export const AUTH_OPTIONS: ClientOAuth2.Options = {
  clientId: GOOGLE_OAUTH_CLIENT_ID,
  clientSecret: GOOGLE_OAUTH_CLIENT_SECRET,
  accessTokenUri: "https://oauth2.googleapis.com/token",
  authorizationUri: "https://accounts.google.com/o/oauth2/v2/auth",
  redirectUri: `${BASE_URL}${AUTH_PREFIX}/oauth_callback`,
  scopes: SCOPES,
};
const GOOGLE_USER_INFO_URL = "https://www.googleapis.com/oauth2/v1/userinfo";

const auth = new ClientOAuth2(AUTH_OPTIONS);
const authRouter = new Router({ prefix: AUTH_PREFIX });

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  picture: string;
}

authRouter.get("/", async (ctx) => {
  ctx.session!.state = uuid();

  const loginHTML = await Purview.render(
    <Login state={ctx.session!.state} />,
    ctx.req
  );

  ctx.body = loginHTML;
});

authRouter.get(AuthPaths.LOGOUT, async (ctx) => {
  if (ctx.session!.user) {
    delete ctx.session!.user;
  }

  ctx.redirect(BASE_URL);
});

authRouter.get(AuthPaths.OAUTH_CALLBACK, async (ctx) => {
  const { code, state, error } = ctx.request.query;
  const { state: sessionState } = ctx.session!;
  if (
    typeof code !== "string" ||
    typeof state !== "string" ||
    state !== sessionState ||
    error
  ) {
    ctx.status = BAD_REQUEST;
    return;
  }

  const token = await auth.code.getToken(ctx.request.url, { state });
  token.sign({ url: GOOGLE_USER_INFO_URL, method: "GET" });

  let userInfo;
  try {
    userInfo = (
      await axios.request(
        token.sign({
          url: GOOGLE_USER_INFO_URL,
        })
      )
    ).data as GoogleUserInfo;
  } catch (error) {
    console.log(`Login error: ${error}`);
    ctx.status = BAD_REQUEST;
    ctx.body = JSON.stringify(error);
    return;
  }

  if (!userInfo.verified_email) {
    ctx.status = BAD_REQUEST;
    ctx.body = "Verify your email first.";
    return;
  }

  let existingUser = await prismaClient.user.findFirst({
    where: { fid: userInfo.id },
  });

  if (!existingUser) {
    existingUser = await prismaClient.user.create({
      data: {
        fid: userInfo.id,
        email: userInfo.email,
      },
    });

    const phoneNumber = await SignalWireREST.buyPhoneNumber();
    const strippedNumber = phoneNumber.substring(1);
    await prismaClient.telephone.create({
      data: { user_id: existingUser.id, number: strippedNumber },
    });
  }

  ctx.session!.user = existingUser;

  ctx.redirect(BASE_URL);
});

export const authRoutes = authRouter.routes();
