import Purview from "purview";
import { GOOGLE_OAUTH_CLIENT_ID } from "./constants";
import { AUTH_OPTIONS } from "./routes/auth";

interface LoginProps {
  state: string;
}

const URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const SCOPES = ["email"];

export class Login extends Purview.Component<LoginProps, {}> {
  render(): JSX.Element {
    const params = [
      `scope=${SCOPES.join(" ")}`,
      `state=${this.props.state}`,
      `redirect_uri=${AUTH_OPTIONS.redirectUri}`,
      "response_type=code",
      `client_id=${GOOGLE_OAUTH_CLIENT_ID}`,
    ].join("&");

    const href = `${URL}?${params}`;
    return <a href={href}>Login </a>;
  }
}
