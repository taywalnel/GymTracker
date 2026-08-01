import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { WriteBatch, getFirestore } from "firebase-admin/firestore";

interface LegacyExercisePrescription {
  id: string;
  name?: string;
  targetWeightKg: number;
  targetReps: number;
  targetSets: number;
  order: number;
}

interface LegacyRoutine {
  id: string;
  name: string;
  rotationOrder: number;
  exercises: LegacyExercisePrescription[];
}

interface ExerciseDefinition {
  id: string;
  name: string;
}

const apply = process.argv.includes("--apply");
const requestedUserId = process.argv
  .find((argument) => argument.startsWith("--user="))
  ?.slice("--user=".length);

if (getApps().length === 0) {
  initializeApp();
}

const database = getFirestore();

function hasOwn(object: object, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, property);
}

async function commitOperations(
  operations: Array<(batch: WriteBatch) => void>,
): Promise<void> {
  if (!apply) {
    console.log(`  Dry run: would commit ${operations.length} write(s).`);
    return;
  }

  for (let start = 0; start < operations.length; start += 500) {
    const batch = database.batch();
    for (const operation of operations.slice(start, start + 500)) {
      operation(batch);
    }
    await batch.commit();
  }
}

async function migrateUser(userId: string): Promise<void> {
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
    return;
  }

  const catalog = new Map<string, ExerciseDefinition>();
  for (const document of catalogSnapshot.docs) {
    const data = document.data() as Partial<ExerciseDefinition>;
    if (data.id !== document.id || !data.name?.trim()) {
      throw new Error(`Invalid catalog exercise at ${document.ref.path}.`);
    }
    catalog.set(document.id, { id: document.id, name: data.name.trim() });
  }

  const routinesToRewrite: Array<{ path: string; data: LegacyRoutine }> = [];

  for (const document of routinesSnapshot.docs) {
    const routine = document.data() as LegacyRoutine;
    if (!Array.isArray(routine.exercises)) {
      throw new Error(`${document.ref.path} has no valid exercises array.`);
    }

    let needsRewrite = false;
    const normalizedExercises = routine.exercises.map((prescription) => {
      if (!prescription.id) {
        throw new Error(
          `${document.ref.path} contains an exercise without an id.`,
        );
      }

      const legacyName = prescription.name?.trim();
      const existing = catalog.get(prescription.id);
      if (legacyName && existing && existing.name !== legacyName) {
        throw new Error(
          `${document.ref.path} has conflicting names for exercise ${prescription.id}: ` +
            `"${existing.name}" and "${legacyName}".`,
        );
      }
      if (legacyName) {
        catalog.set(prescription.id, { id: prescription.id, name: legacyName });
      }
      if (!catalog.has(prescription.id)) {
        throw new Error(
          `${document.ref.path} references ${prescription.id}, which has neither a catalog document nor a legacy name.`,
        );
      }

      if (hasOwn(prescription, "name")) {
        needsRewrite = true;
      }
      const { name: _legacyName, ...normalized } = prescription;
      return normalized;
    });

    if (needsRewrite) {
      routinesToRewrite.push({
        path: document.ref.path,
        data: { ...routine, exercises: normalizedExercises },
      });
    }
  }

  const operations: Array<(batch: WriteBatch) => void> = [];
  operations.push((batch) =>
    batch.set(userRef, { schemaVersion: 2 }, { merge: true }),
  );
  for (const exercise of catalog.values()) {
    const exerciseRef = userRef.collection("exercises").doc(exercise.id);
    operations.push((batch) =>
      batch.set(exerciseRef, exercise, { merge: true }),
    );
  }
  for (const routine of routinesToRewrite) {
    const routineRef = database.doc(routine.path);
    operations.push((batch) => batch.set(routineRef, routine.data));
  }

  console.log(
    `${userId}: ${catalog.size} catalog exercise(s), ${routinesToRewrite.length} routine(s) to normalize.`,
  );
  await commitOperations(operations);
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
  console.log(
    apply
      ? "Applying exercise catalog migration."
      : "Running exercise catalog migration in dry-run mode.",
  );

  const userIds = await getUserIds();

  for (const userId of userIds) {
    await migrateUser(userId);
  }

  console.log("Migration completed.");
}

void main().catch((error: unknown) => {
  console.error("Migration failed:", error);
  process.exitCode = 1;
});
