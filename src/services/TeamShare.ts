import { User } from "@prisma/client";
import { prismaClient } from "../prisma";

export default class TeamShare {
  private constructor() {}

  static async create(from: Pick<User, "id">, to: Pick<User, "id">) {
    await prismaClient.shareRequest.create({
      data: {
        from_user_id: from.id,
        to_user_id: to.id,
        completed: false,
      },
    });
  }

  static async delete(from: Pick<User, "id">, to: Pick<User, "id">) {
    await prismaClient.shareRequest.deleteMany({
      where: {
        from_user_id: from.id,
        to_user_id: to.id,
      },
    });
  }

  static async accept(from: Pick<User, "id">, to: Pick<User, "id">) {
    await prismaClient.shareRequest.update({
      where: {
        from_user_id_to_user_id: { from_user_id: from.id, to_user_id: to.id },
      },
      data: { completed: true },
    });
  }

  static async getSharingUsers(user: Pick<User, "id">) {
    const finishedRequests = await prismaClient.shareRequest.findMany({
      where: { to_user_id: user.id, completed: true },
    });

    const sharingUsers = await prismaClient.user.findMany({
      where: {
        id: { in: finishedRequests.map((r) => r.from_user_id) },
      },
    });

    return sharingUsers;
  }

  static async getSharedToUsers(user: Pick<User, "id">) {
    const finishedRequests = await prismaClient.shareRequest.findMany({
      where: { from_user_id: user.id, completed: true },
    });

    const sharedUsers = await prismaClient.user.findMany({
      where: {
        id: { in: finishedRequests.map((r) => r.to_user_id) },
      },
    });

    return sharedUsers;
  }

  static async getPendingOutgoingRequests(from: Pick<User, "id">) {
    const requests = await prismaClient.shareRequest.findMany({
      where: { from_user_id: from.id, completed: false },
    });

    const users = await prismaClient.user.findMany({
      where: { id: { in: requests.map((r) => r.to_user_id) } },
    });

    return requests.map((r) => ({
      ...r,
      toUser: users.find((u) => u.id === r.to_user_id)!,
    }));
  }

  static async getPendingIncomingRequests(to: Pick<User, "id">) {
    const requests = await prismaClient.shareRequest.findMany({
      where: { to_user_id: to.id, completed: false },
    });

    const users = await prismaClient.user.findMany({
      where: { id: { in: requests.map((r) => r.from_user_id) } },
    });

    return requests.map((r) => ({
      ...r,
      fromUser: users.find((u) => u.id === r.from_user_id)!,
    }));
  }
}
