import { format } from "date-fns";
import { Message, Telephone, User, ShareRequest } from ".prisma/client";
import Purview, { css } from "purview";
import { messageEventEmitter, NEW_MESSAGE_EVENT, SHARE_REQUEST_EVENT } from ".";
import { ForwardingNumberForm } from "./forwarding_number_form";
import { prismaClient } from "./prisma";
import { AuthPaths, AUTH_PREFIX } from "./routes/auth";
import TeamShare from "./services/TeamShare";
import { ShareRequestForm } from "./share_request_form";

export const middleBlueGreen = "#82d4bbff";
export const etonBlue = "#82c09aff";
export const greenBlue = "#82ac9fff";
export const lightSlateGray = "#829298ff";
export const mountBattenPink = "#94778bff";

export const buttonCSS = css({
  display: "inline-block",
  cursor: "pointer",
  padding: "1.1rem 1.5rem",
  fontWeight: "bold",
  letterSpacing: "1px",
  textAlign: "center",
  textTransform: "uppercase",
  textDecoration: "none",
  color: "white",
  background: etonBlue,
  border: "none",
  borderRadius: "3px",
  outline: "none",
  position: "relative",
  whiteSpace: "nowrap",
});

interface AppProps {
  user_id: number;
}

interface TelephoneMessages extends Telephone {
  messages: Message[];
}

interface AppState {
  user: User;
  // The user's own phone number is always the first element of this array.
  telephoneMessages: TelephoneMessages[];
  requests: {
    incoming: Array<ShareRequest & { fromUser: User }>;
    outgoing: Array<ShareRequest & { toUser: User }>;
  };
  activeShares: User[];
}

const nonePlaceholder = (
  <ul>
    <em>(None)</em>
  </ul>
);

const borderBottomCSS = css({
  borderBottom: "1px solid rgba(130, 146, 152, .5)",
  padding: "1rem",
  paddingBottom: "2rem",
});

export class App extends Purview.Component<AppProps, AppState> {
  async getInitialState(): Promise<AppState> {
    const { user_id } = this.props;
    const user = (await prismaClient.user.findFirst({
      where: { id: user_id },
    }))!;

    const [telephoneMessages, requests, activeShares] = await Promise.all([
      getTelephoneMessages(user),
      getShareRequests(user),
      getActiveShares(user),
    ]);

    return { user, telephoneMessages, requests, activeShares };
  }

  componentDidMount(): void {
    const { user, telephoneMessages } = this.state;
    this.subscribe(telephoneMessages);
    messageEventEmitter.on(SHARE_REQUEST_EVENT + String(user.id), async () => {
      await this.refreshShareData();
    });
  }

  componentWillUnmount(): void {
    const { user, telephoneMessages } = this.state;
    this.unsubscribe(telephoneMessages);
    messageEventEmitter.off(SHARE_REQUEST_EVENT + String(user.id));
  }

  subscribe(telephones: Telephone[]): void {
    for (const telephone of telephones) {
      messageEventEmitter.on(
        NEW_MESSAGE_EVENT + String(telephone.id),
        this.handleMessageEvent
      );
    }
  }

  unsubscribe(telephones: Telephone[]): void {
    for (const telephone of telephones) {
      messageEventEmitter.off(
        NEW_MESSAGE_EVENT + String(telephone.id),
        this.handleMessageEvent
      );
    }
  }

  async handleMessageEvent(): Promise<void> {
    const { user } = this.state;
    await this.setState({
      telephoneMessages: await getTelephoneMessages(user),
    });
  }

  async refreshShareData(): Promise<void> {
    const { user, telephoneMessages: oldTelephones } = this.state;

    const [telephoneMessages, requests, activeShares] = await Promise.all([
      getTelephoneMessages(user),
      getShareRequests(user),
      getActiveShares(user),
    ]);
    this.unsubscribe(oldTelephones);
    this.subscribe(telephoneMessages);

    await this.setState({ telephoneMessages, requests, activeShares });
  }

  async onForwardingNumberFormUpdate(): Promise<void> {
    const { user_id } = this.props;
    const user = (await prismaClient.user.findFirst({
      where: { id: user_id },
    }))!;
    await this.setState({ user });
  }

  async acceptShareRequest(shareRequestID: number): Promise<void> {
    const { requests, user } = this.state;
    const shareRequest = requests.incoming.find((r) => r.id === shareRequestID);
    if (shareRequest) {
      await TeamShare.accept({ id: shareRequest.from_user_id }, user);
      messageEventEmitter.emit(
        SHARE_REQUEST_EVENT + String(shareRequest.from_user_id)
      );
    }
    await this.refreshShareData();
  }

  async rejectShareRequest(shareRequestID: number): Promise<void> {
    const { requests, user } = this.state;
    const shareRequest = requests.incoming.find((r) => r.id === shareRequestID);
    if (shareRequest) {
      await TeamShare.delete({ id: shareRequest.from_user_id }, user);
      messageEventEmitter.emit(
        SHARE_REQUEST_EVENT + String(shareRequest.from_user_id)
      );
    }
    await this.refreshShareData();
  }

  async cancelShareRequest(shareRequestID: number): Promise<void> {
    const { requests, user } = this.state;
    const shareRequest = requests.outgoing.find((r) => r.id === shareRequestID);
    if (shareRequest) {
      await TeamShare.delete(user, { id: shareRequest.to_user_id });
      messageEventEmitter.emit(
        SHARE_REQUEST_EVENT + String(shareRequest.to_user_id)
      );
    }
    await this.refreshShareData();
  }

  async cancelActiveShare(sharedUserID: number): Promise<void> {
    const { user } = this.state;
    await TeamShare.delete(user, { id: sharedUserID });
    messageEventEmitter.emit(SHARE_REQUEST_EVENT + String(sharedUserID));
    await this.refreshShareData();
  }

  async cancelActiveSharedWithMe(sharingUserID: number): Promise<void> {
    const { user } = this.state;
    await TeamShare.delete({ id: sharingUserID }, user);
    messageEventEmitter.emit(SHARE_REQUEST_EVENT + String(sharingUserID));
    await this.refreshShareData();
  }

  async deleteMessage(messageID: number): Promise<void> {
    const { user, telephoneMessages: oldTelephones } = this.state;
    await prismaClient.message.delete({ where: { id: messageID } });

    const telephoneMessages = await getTelephoneMessages(user);
    this.unsubscribe(oldTelephones);
    this.subscribe(telephoneMessages);
    await this.setState({ telephoneMessages });
  }

  render(): JSX.Element {
    const { user } = this.state;

    return (
      <div>
        {this.renderHeader()}
        <div css={borderBottomCSS}>
          <ForwardingNumberForm
            onUpdate={this.onForwardingNumberFormUpdate.bind(this)}
            user={user}
          />
        </div>
        <div css={borderBottomCSS}>{this.renderShareSection()}</div>
        <div css={borderBottomCSS}>{this.renderTelephoneMessages()}</div>
      </div>
    );
  }

  renderHeader(): JSX.Element {
    const { user, telephoneMessages } = this.state;

    return (
      <div
        css={css({
          padding: "1rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(130, 146, 152, .5)",
        })}
      >
        <div>{user.email}</div>
        <div>
          Your Phone Number: <strong>{telephoneMessages[0].number}</strong>
        </div>
        <a css={buttonCSS} href={AUTH_PREFIX + AuthPaths.LOGOUT}>
          Logout
        </a>
      </div>
    );
  }

  renderShareSection(): JSX.Element {
    const { user, requests, activeShares } = this.state;

    const incomingRequestElements = requests.incoming.map((r) => {
      return (
        <li>
          From {r.fromUser.email}
          <button
            onClick={this.acceptShareRequest.bind(this, r.id)}
            css={css(buttonCSS, {
              marginLeft: "1rem",
            })}
          >
            Accept
          </button>
          <button
            onClick={this.rejectShareRequest.bind(this, r.id)}
            css={css(buttonCSS, {
              background: mountBattenPink,
              marginLeft: "1rem",
            })}
          >
            Delete
          </button>
        </li>
      );
    });

    const outgoingRequestElements = requests.outgoing.map((r) => {
      return (
        <li>
          To {r.toUser.email}
          <button
            onClick={this.cancelShareRequest.bind(this, r.id)}
            css={css(buttonCSS, {
              background: mountBattenPink,
              marginLeft: "1rem",
            })}
          >
            Cancel
          </button>
        </li>
      );
    });

    const activeShareElements = activeShares.map((s) => {
      return (
        <li>
          Sharing with {s.email}
          <button
            onClick={this.cancelActiveShare.bind(this, s.id)}
            css={css(buttonCSS, {
              background: mountBattenPink,
              marginLeft: "1rem",
            })}
          >
            Stop sharing
          </button>
        </li>
      );
    });

    return (
      <div
        css={css({
          padding: "1rem",
          gap: "1rem",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
        })}
      >
        <div>
          <h3>Outgoing share requests:</h3>
          <ul>{outgoingRequestElements}</ul>
          {outgoingRequestElements.length === 0 && nonePlaceholder}
          <ShareRequestForm
            onSubmit={this.refreshShareData.bind(this)}
            user={user}
          />
        </div>

        <div>
          <h3>Incoming share invitations:</h3>
          <ul>{incomingRequestElements}</ul>
          {incomingRequestElements.length === 0 && nonePlaceholder}

          <h3>Currently sharing:</h3>
          <ul>{activeShareElements}</ul>
          {activeShareElements.length === 0 && nonePlaceholder}
        </div>
      </div>
    );
  }

  renderTelephoneMessages(): JSX.Element {
    const { telephoneMessages } = this.state;

    const telephoneElements = telephoneMessages.map((t, tIndex) => {
      const messageElements = t.messages.map((m) => {
        return (
          <li css={css({ display: "flex", marginBottom: "1rem" })}>
            {tIndex === 0 && (
              <button
                onClick={this.deleteMessage.bind(this, m.id)}
                css={css(buttonCSS, {
                  background: mountBattenPink,
                  marginRight: "1rem",
                })}
              >
                Delete
              </button>
            )}
            <div>
              <div>
                <b>From:</b> {m.from} - {format(m.created_at, "Pp")}
              </div>
              <div>
                <b>Body:</b> {m.body}
              </div>
            </div>
          </li>
        );
      });

      return (
        <div>
          <h3>Messages for {t.number}:</h3>
          {tIndex > 0 && (
            <button
              onClick={this.cancelActiveSharedWithMe.bind(this, t.user_id)}
              css={css(buttonCSS, {
                background: mountBattenPink,
                marginRight: "1rem",
              })}
            >
              I no longer want to see messages from this number
            </button>
          )}
          <ul>{messageElements}</ul>
          {messageElements.length === 0 && nonePlaceholder}
        </div>
      );
    });

    return <div css={css({ padding: "1rem" })}>{telephoneElements}</div>;
  }
}

async function getShareRequests(user: User) {
  const [incoming, outgoing] = await Promise.all([
    TeamShare.getPendingIncomingRequests(user),
    TeamShare.getPendingOutgoingRequests(user),
  ]);

  return { incoming, outgoing };
}

async function getActiveShares(user: User) {
  const sharedToUsers = await TeamShare.getSharedToUsers(user);

  return sharedToUsers;
}

async function getTelephoneMessages(user: User): Promise<TelephoneMessages[]> {
  const userTelephone = await prismaClient.telephone.findFirst({
    where: { user_id: user.id },
  });
  if (!userTelephone) {
    throw new Error(`User ${user.id} does not have a phone number.`);
  }

  const sharingUsers = await TeamShare.getSharingUsers(user);

  // Always ensure that user's telephone is first in the array.
  const telephones = [userTelephone];
  if (sharingUsers.length > 0) {
    telephones.push(
      ...(await prismaClient.telephone.findMany({
        where: { user_id: { in: sharingUsers.map((u) => u.id) } },
      }))
    );
  }

  const messages = await prismaClient.message.findMany({
    where: { telephone_id: { in: telephones.map((t) => t.id) } },
    orderBy: { id: "desc" },
  });

  const x = telephones.map((t) => {
    return {
      ...t,
      messages: messages.filter((m) => m.telephone_id === t.id),
    };
  });

  return x;
}
