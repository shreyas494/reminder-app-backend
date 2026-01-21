// // services/smsService.js
// import twilio from "twilio";

// const client = twilio(
//   process.env.TWILIO_ACCOUNT_SID,
//   process.env.TWILIO_AUTH_TOKEN
// );

// export const sendSMS = async ({ to, message }) => {
//   return client.messages.create({
//     from: process.env.TWILIO_SMS_FROM, // Twilio phone number
//     to,
//     body: message,
//   });
// };
