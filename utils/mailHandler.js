const nodemailer = require("nodemailer");


const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 25,
    secure: false, // Use true for port 465, false for port 587
    auth: {
        user: "4cfafa0b47ccc4",
        pass: "43d9dceacf8863",
    },
});

module.exports = {
    sendMail: async (to, url) => {
        const info = await transporter.sendMail({
            from: 'Admin@hahah.com',
            to: to,
            subject: "request resetpassword email",
            text: "click vao day de reset", // Plain-text version of the message
            html: "click vao <a href=" + url + ">day</a> de reset", // HTML version of the message
        });

        console.log("Message sent:", info.messageId);
    },
    sendPasswordMail: async (to, username, password) => {
        const info = await transporter.sendMail({
            from: 'Admin@hahah.com',
            to: to,
            subject: "Your account has been created",
            text: `Hello ${username}, your account has been created. Your password is: ${password}`,
            html: `<h2>Welcome ${username}!</h2>
                   <p>Your account has been created successfully.</p>
                   <p><strong>Username:</strong> ${username}</p>
                   <p><strong>Password:</strong> ${password}</p>
                   <p>Please change your password after first login.</p>`,
        });
        console.log("Password email sent:", info.messageId);
    }
}