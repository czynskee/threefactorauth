import crypto from "crypto";
import { User } from ".prisma/client";
import Purview, { ChangeEvent, css } from "purview";
import { messageEventEmitter, messagingClient, VALIDATION_CODE_EVENT } from ".";
import { SIGNALWIRE_CONTEXT } from "./constants";
import { prismaClient } from "./prisma";
import { buttonCSS } from "./app";

interface ForwardingNumberFormProps {
  user: User;
  onUpdate: () => Promise<void>;
}

interface ForwardingNumberFormState {
  phoneNumber: string;
  code: string;
  errorText: string;
}

export class ForwardingNumberForm extends Purview.Component<
  ForwardingNumberFormProps,
  ForwardingNumberFormState
> {
  componentDidMount() {
    const { user, onUpdate } = this.props;
    messageEventEmitter.on(
      VALIDATION_CODE_EVENT + String(user.id),
      async (body: string) => {
        const validationCode = await prismaClient.validationCode.findFirst({
          where: { user_id: user.id, code: body },
        });
        if (validationCode) {
          await prismaClient.user.update({
            where: {
              id: user.id,
            },
            data: {
              forwarding_number: validationCode.forwarding_number,
            },
          });
          await prismaClient.validationCode.delete({
            where: {
              id: validationCode.id,
            },
          });

          await onUpdate();

          await this.setState({
            phoneNumber: "",
            code: "",
            errorText: "",
          });
        } else {
          await this.setState({
            phoneNumber: "",
            code: "",
            errorText: "You entered the wrong code!",
          });
        }
      }
    );
  }

  componentWillUnmount() {
    const { user } = this.props;
    messageEventEmitter.off(VALIDATION_CODE_EVENT + String(user.id));
  }

  async handleSubmit() {
    const { user } = this.props;
    const { phoneNumber } = this.state;
    const number = Number(phoneNumber);

    // delete any stale validation codes
    await prismaClient.validationCode.deleteMany({
      where: {
        user_id: user.id,
      },
    });

    if (isNaN(number) || phoneNumber.length !== 11) {
      await this.setState({
        errorText: "Numbers should be 11 digits and all numeric.",
        phoneNumber: "",
        code: "",
      });
      return;
    }

    const telephone = (await prismaClient.telephone.findFirst({
      where: { user_id: user.id },
    }))!;

    try {
      await messagingClient.send({
        context: SIGNALWIRE_CONTEXT,
        from: "+" + telephone.number,
        to: "+" + phoneNumber,
        body: "To validate your number for threefactorauth, text back the 6 digit number on your screen.",
      });
    } catch (error) {
      await this.setState({
        errorText: "There was an error!",
        phoneNumber: "",
        code: "",
      });
      console.log(error);
      return;
    }

    const code = String(crypto.randomInt(100000, 999999));
    await prismaClient.validationCode.create({
      data: {
        code,
        user_id: user.id,
        forwarding_number: phoneNumber,
      },
    });

    await this.setState({
      phoneNumber: "",
      code,
      errorText: "",
    });
  }

  async onChange(event: ChangeEvent<string>) {
    await this.setState({ phoneNumber: event.value });
  }

  async removeForwardingNumber() {
    const { user, onUpdate } = this.props;
    await prismaClient.user.update({
      where: { id: user.id },
      data: { forwarding_number: null },
    });
    await onUpdate();
  }

  render() {
    const { user } = this.props;
    const { phoneNumber, errorText, code } = this.state;

    if (user.forwarding_number) {
      return (
        <div>
          <h3>Current Forwarding Number:</h3>
          <strong>{user.forwarding_number}</strong>
          <button
            css={css(buttonCSS, { marginLeft: "1rem" })}
            onClick={this.removeForwardingNumber.bind(this)}
          >
            Remove Forwarding Number
          </button>
        </div>
      );
    }

    return (
      <div>
        <h3>Set Forwarding Number</h3>
        <p>
          This will cause all numbers received by your phone number to be
          forwarded to the number you input.
        </p>
        {errorText && <p css={css({ color: "red" })}>{errorText}</p>}
        {code && <span>{code}</span>}
        <form onSubmit={this.handleSubmit.bind(this)}>
          <input
            type="text"
            value={phoneNumber ?? ""}
            onChange={this.onChange.bind(this)}
          ></input>
          <button css={css(buttonCSS, { marginLeft: "1rem" })} role="submit">
            Submit
          </button>
        </form>
      </div>
    );
  }
}
