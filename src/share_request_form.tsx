import { User } from ".prisma/client";
import Purview, { ChangeEvent, css } from "purview";
import { prismaClient } from "./prisma";
import { buttonCSS } from "./app";
import TeamShare from "./services/TeamShare";
import { messageEventEmitter, SHARE_REQUEST_EVENT } from ".";

interface ShareRequestFormProps {
  user: User;
  onSubmit: () => Promise<void>;
}

interface ShareRequestFormState {
  recipientEmail: string;
  errorText: string;
}

export class ShareRequestForm extends Purview.Component<
  ShareRequestFormProps,
  ShareRequestFormState
> {
  async getInitialState(): Promise<ShareRequestFormState> {
    return { recipientEmail: "", errorText: "" };
  }

  async handleSubmit() {
    const { user, onSubmit } = this.props;
    const { recipientEmail } = this.state;

    const recipient = await prismaClient.user.findFirst({
      where: { email: recipientEmail },
    });

    if (!recipient) {
      return await this.setState({
        errorText: "This user could not be found.",
        recipientEmail: "",
      });
    }

    if (recipient.id === user.id) {
      return await this.setState({
        errorText: "You cannot share with yourself.",
        recipientEmail: "",
      });
    }

    const pendingInvitation = await prismaClient.shareRequest.findFirst({
      where: { to: recipient, from: user },
    });

    if (pendingInvitation) {
      let errorText;
      if (pendingInvitation.completed) {
        errorText =
          "You have already shared your number's messages with this user.";
      } else {
        errorText = "You already have a pending invitation to this user.";
      }
      return await this.setState({
        errorText,
        recipientEmail: "",
      });
    }

    try {
      await TeamShare.create(user, recipient);
      messageEventEmitter.emit(SHARE_REQUEST_EVENT + String(recipient.id));
      await this.setState({ errorText: "", recipientEmail: "" });
    } catch (error) {
      await this.setState({
        errorText: "There was an error!",
        recipientEmail: "",
      });
      console.log(error);
      return;
    }

    await onSubmit();
  }

  async onChange(event: ChangeEvent<string>) {
    await this.setState({ recipientEmail: event.value });
  }

  render() {
    const { recipientEmail, errorText } = this.state;

    return (
      <div>
        <p>
          The recipient will be able to see all of the messages ever received by
          your phone number. Invite another user with their email address.
        </p>
        {errorText && <p css={css({ color: "red" })}>{errorText}</p>}
        <form onSubmit={this.handleSubmit.bind(this)}>
          <input
            type="text"
            value={recipientEmail ?? ""}
            onChange={this.onChange.bind(this)}
          />
          <button
            // onClick={this.handleSubmit.bind(this)}
            css={css(buttonCSS, { marginLeft: "1rem" })}
            role="button"
          >
            Invite
          </button>
        </form>
      </div>
    );
  }
}
