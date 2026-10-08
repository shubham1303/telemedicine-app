import React from "react";
import ReactDOM from "react-dom/client";
import { Amplify } from "aws-amplify";
import awsExports from "./aws-exports";
import App from "./App";
import "./index.css";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: awsExports.Auth.Cognito.userPoolId,
      userPoolClientId: awsExports.Auth.Cognito.userPoolClientId,
      region: awsExports.Auth.Cognito.region,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);