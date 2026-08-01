import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp();
}

const database = getFirestore();
const requestedUserId = process.argv
  .find((argument) => argument.startsWith("--user="))
  ?.slice("--user=".length);

function hasOwn(object: object, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, property);
}

async function verifyUser(userId: string): Promise<number> {
  const userRef = database.doc(`users/${userId}`);
  const [userSnapshot, routinesSnapshot, catalogSnapshot, sessionsSnapshot] =
    await Promise.all([
      userRef.get(),
      userRef.collection("routines").get(),
      userRef.collection("exercises").get(),
      userRef.collection("sessions").get(),
    ]);

  if (
    !userSnapshot.exists &&
    routinesSnapshot.empty &&
    catalogSnapshot.empty &&
    sessionsSnapshot.empty
  ) {
    console.log(`${userId}: skipped because no Firestore data exists.`);
    return 0;
  }
  let failures = 0;

  if (userSnapshot.data()?.["schemaVersion"] !== 2) {
    console.error(`${userRef.path}: missing schemaVersion 2.`);
    failures += 1;
  }

  const catalog = new Map<string, { id?: unknown; name?: unknown }>();
  for (const document of catalogSnapshot.docs) {
    const data = document.data() as { id?: unknown; name?: unknown };
    catalog.set(document.id, data);
    if (
      data.id !== document.id ||
      typeof data.name !== "string" ||
      !data.name.trim()
    ) {
      console.error(`${document.ref.path}: invalid exercise definition.`);
      failures += 1;
    }
  }

  for (const document of routinesSnapshot.docs) {
    const data = document.data() as { exercises?: unknown };
    if (!Array.isArray(data.exercises)) {
      console.error(`${document.ref.path}: missing exercises array.`);
      failures += 1;
      continue;
    }

    for (const prescription of data.exercises) {
      if (!prescription || typeof prescription !== "object") {
        console.error(`${document.ref.path}: invalid routine exercise.`);
        failures += 1;
        continue;
      }
      const exercise = prescription as { id?: unknown };
      if (hasOwn(exercise, "name")) {
        console.error(
          `${document.ref.path}: routine exercise still contains a name.`,
        );
        failures += 1;
      }
      if (typeof exercise.id !== "string" || !catalog.has(exercise.id)) {
        console.error(
          `${document.ref.path}: missing catalog reference for ${String(exercise.id)}.`,
        );
        failures += 1;
      }
    }
  }

  for (const document of sessionsSnapshot.docs) {
    const data = document.data() as { exerciseLogs?: unknown };
    if (!Array.isArray(data.exerciseLogs)) {
      console.error(`${document.ref.path}: missing exerciseLogs array.`);
      failures += 1;
      continue;
    }
    for (const log of data.exerciseLogs) {
      if (!log || typeof log !== "object") {
        console.error(`${document.ref.path}: invalid historical exercise log.`);
        failures += 1;
        continue;
      }
      const exerciseLog = log as { exerciseName?: unknown };
      if (
        typeof exerciseLog.exerciseName !== "string" ||
        !exerciseLog.exerciseName.trim()
      ) {
        console.error(
          `${document.ref.path}: historical exercise log has no immutable exerciseName.`,
        );
        failures += 1;
      }
    }
  }

  console.log(
    `${userId}: ${failures === 0 ? "passed" : `${failures} issue(s)`}.`,
  );
  return failures;
}

async function getUserIds(): Promise<string[]> {
  if (requestedUserId) return [requestedUserId];

  const userIds: string[] = [];
  let pageToken: string | undefined;
  do {
    const page = await getAuth().listUsers(1000, pageToken);
    userIds.push(...page.users.map((user) => user.uid));
    pageToken = page.pageToken;
  } while (pageToken);
  return userIds;
}

async function main(): Promise<void> {
  const userIds = await getUserIds();
  let failures = 0;

  for (const userId of userIds) {
    failures += await verifyUser(userId);
  }

  if (failures > 0) {
    throw new Error(`Verification failed with ${failures} issue(s).`);
  }
  console.log("Exercise catalog verification passed.");
}

void main().catch((error: unknown) => {
  console.error("Verification failed:", error);
  process.exitCode = 1;
});
