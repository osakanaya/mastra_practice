import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { ManagedPolicy } from "aws-cdk-lib/aws-iam";

const backend = defineBackend({
  auth,
});

const authenticatedUserIamRole = backend.auth.resources.authenticatedUserIamRole;

authenticatedUserIamRole.addManagedPolicy(
  ManagedPolicy.fromAwsManagedPolicyName("AmazonBedrockFullAccess")
);

