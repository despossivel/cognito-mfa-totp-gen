const prompt = require("prompt");
const qrcode = require("qrcode-terminal");
const AmazonCognitoIdentity = require("amazon-cognito-identity-js");

const CONFIG = {
  UserPoolId: "",
  ClientId: "",
};

main = function () {
  prompt.start();

  const promptSchema = {
    properties: {
      username: { required: true },
      password: { hidden: true },
    },
  };

  prompt.get(promptSchema, function (err, result) {
    let username = result["username"];
    let password = result["password"];

    const poolData = {
      UserPoolId: CONFIG.UserPoolId,
      ClientId: CONFIG.ClientId,
    };

    const userData = {
      Username: username,
      Pool: new AmazonCognitoIdentity.CognitoUserPool(poolData),
    };

    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

    const authenticationData = {
      Username: username,
      Password: password,
    };

    const authenticationDetails =
      new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);

    const totpMfaSettings = {
      PreferredMfa: true,
      Enabled: true,
    };

    // authenticate user
    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: function (result) {
        var accessToken = result.getAccessToken().getJwtToken();
        console.info(accessToken);
        cognitoUser.getUserData((err, data) => {
          if (err) {
            alert(err.message || JSON.stringify(err));
            return;
          }
          const { PreferredMfaSetting } = data;

          console.log(data)
 

          if (PreferredMfaSetting != "SOFTWARE_TOKEN_MFA") {
            setupMFA();
          }
        });
      },
      newPasswordRequired: function () {
        console.info("Set your password again");
        cognitoUser.completeNewPasswordChallenge(password, {}, this);
      },
      totpRequired: function () {
        console.info("Need to set TOTP");
        let _this = this;
        let getValue = "Input code from Authenticator App";
        prompt.get([getValue], function (err, result) {
          var challengeAnswer = result[getValue];
          cognitoUser.sendMFACode(challengeAnswer, _this, "SOFTWARE_TOKEN_MFA");
        });
      },
      onFailure: function (err) {
        console.log(err.message || JSON.stringify(err));
      },
    });

    const setupMFA = () => {
      cognitoUser.associateSoftwareToken({
        associateSecretCode: function (secretCode) {
          console.info("AssociateSecretCode");
          console.info("Display QR Code");

          const url = `otpauth://totp/${username}?secret=${secretCode}&issuer=Cognito-TOTP-MFA`;
          console.info("Your secret Code: " + secretCode);
          qrcode.generate(url, { small: true });

          const getValue =
            "Open Authenticator App And Scan this image or enter manually";
          prompt.get([getValue], function (err, result) {
            challengeAnswer = result[getValue];
            cognitoUser.verifySoftwareToken(
              result[getValue],
              "My TOTP device",
              {
                onFailure: function (err) {
                  console.error(err.message || JSON.stringify(err));
                },
                onSuccess: function (result) {
                  console.info(result);
                  enableMFA();
                },
              }
            );
          });
        },
        onFailure: function (err) {
          console.error(err.message || JSON.stringify(err));
        },
      });
    };

    const enableMFA = () => {
      cognitoUser.setUserMfaPreference(
        null,
        totpMfaSettings,
        function (err, result) {
          if (err) {
            alert(err.message || JSON.stringify(err));
          }
          console.log("call result " + result);
        }
      );
    };
  });
};

main();