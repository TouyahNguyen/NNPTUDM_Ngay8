let userModel = require("../schemas/users");
let bcrypt = require('bcrypt');

module.exports = {
    CreateAnUser: async function (username, password, email, role,
        fullName, avatarUrl, status, loginCount
    ) {
        let newUser = new userModel({
            username: username,
            password: password,
            email: email,
            fullName: fullName,
            avatarUrl: avatarUrl,
            status: status,
            role: role,
            loginCount: loginCount
        })
        await newUser.save();
        return newUser;
    },
    FindUserByUsername: async function (username) {
        return await userModel.findOne({
            isDeleted: false,
            username: username
        })
    },
    CompareLogin: async function (user,password) {
        if(bcrypt.compareSync(password,user.password)){
            user.loginCount = 0;
            await user.save()
            return user;
        }
        user.loginCount++;
        if(user.loginCount==3){
            user.lockTime = new Date(Date.now()+24*60*60*1000);
            user.loginCount=0;
        }
        await user.save()
        return false;
    }
}