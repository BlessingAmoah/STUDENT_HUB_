const express = require('express')
const router = express.Router();
const Sequelize = require('sequelize');
const { User, Friend } = require('../models');
const verifyToken = require('../middleware/auth');
const { Post, Like, Comment} = require('../models');
const { Op } = require('sequelize');


// Add a friend
router.post('/add', verifyToken, async (req, res) => {
    try {
        const { userId, friendId } = req.body;

        // check if the userId and friendId are the same
        if (userId === friendId){
            return res.status(400).json({ error: "Sorry, you can't add yourself as a friend"});
        }

        //verify if the friendId exists in Users table
        const friendUser = await User.findByPk(friendId);
        if(!friendUser){
            return res.status(404).json({ error: 'friend not found'});
        }
        // check if the friend already exist
        const existingFriend = await Friend.findOne({
            where: { userId, friendId }
        });
        if (existingFriend){
            return res.status(400).json({ error: 'Friend already exist'});
        }
        // add a new friend
        const newFriend = await Friend.create({
            userId,
            friendId,
            friendName: friendUser.name
        });
        res.status(201).json(newFriend);
    }
    catch(error) {
        console.error('Error adding friend:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Delete a friend
router.delete('/remove', verifyToken, async (req, res) => {
    try {
        const {
            userId, friendId
        } = req.body;

        //check if the friend already exist
        const friendExist = await Friend.findOne({
            where: { userId, friendId }
        });
        if (!friendExist) {
            return res.status(404).json({ error: 'Friend not found'});
        }

        // delete friend from list
        await friendExist.destroy();
        res.status(200).json({ message: 'Friend removed successfully' });
    } catch (error) {
        console.error('Error removing friend:', error);
        res.status(500).json({ error: 'Internal server error'})
    }
});

// Get friends list
router.get('/:userId', verifyToken, async (req, res) => {
    try {
        const userId = req.params.userId;
        if (!userId || userId === 'null') {
            throw new Error('Invalid userId');
        }
        const friends = await Friend.findAll({
            where: { userId },
            include: [{ model: User, as: 'FriendUser', attributes: ['id', 'name', 'major', 'school', 'interest']}]
        });

        // format the friend list
        const formatFriends = friends.map( user =>  ({
            id: user.FriendUser.id,
            name: user.friendName || user.FriendUser.name,
            school: user.FriendUser.school,
            major: user.FriendUser.major,
            interest: user.FriendUser.interest
        }));

        res.status(200).json(formatFriends);
    } catch (error){
        console.error('Error fetching friends:', error);
        res.status(500).json({ error: 'Internal server error'})
    }
});

// friend recommendation
router.get('/recommendedFriends/:userId', verifyToken, async (req, res) => {
    try{
        const userId = req.params.userId;

        // fetch all post with their likes and comments
        const posts = await Post.findAll({
            include: [
                // Include the likes with user information
                { model: Like, include: [User] },
                // Include comments with user information
                { model: Comment, include: [User] }
            ],
        });
        // extract the user ids of the current user's likes and comments
        const currentUserLikes = posts.flatMap( post => post.Likes.map(like => like.User.id));
        const currentUserComments = posts.flatMap(post => post.Comments.map(comment => comment.User.id));

        //fetch user profile to get interests, school, and major
        const currentUser = await User.findByPk(userId);

        // fetch current user's friends
        const friends = await Friend.findAll({ where: { userId }});
        const friendIds = friends.map(friend => friend.friendId);

        // fecth users who interacted with the same posts ( likes or comments)
        const potentialFriends = await User.findAll({
            where: {
                id: {
                    // exclude the current user and friends
                    [Op.notIn]: friendIds.concat(userId)
                },
                [Op.or]: [
                    { id: { [Op.in]: currentUserLikes }},
                    { id: { [Op.in]: currentUserComments}}
                ],
                [Op.or]: [
                    { interest: { [Op.like]: `%${currentUser.interest}%` } },
                    { major: { [Op.like]: `%${ currentUser.major}%`}},
                    { school: { [Op.like]: `%${ currentUser.school}%`}}
                ]
            },
            attributes: ['id', 'name', 'interest', 'school', 'major']
        });

        //format the recommended friends data
        const formatRecommendation = potentialFriends.map(user => ({
            id: user.id,
            name: user.name,
            interest: user.interest,
            school: user.school,
            major: user.major
        }));
        res.status(200).json(formatRecommendation);
    } catch(error) {
        console.error('Error fetching recommended friends:', error);
        res.status(500).json({ error: 'internal server error' })
    }
});

// available people not friends
router.get('/available/:userId', verifyToken, async ( req, res) => {
    try{
        const friends = await Friend.findAll({ where: { userId: req.params.userId }});
        const friendIds = friends.map(friend => friend.friendId);
        const availableFriend = await User.findAll({
            where: {
                id: {
                    [Sequelize.Op.notIn]: friendIds
                }
            }
        });

        res.json(availableFriend);
    } catch (error) {
        console.error('Error fetching availe friend:', error)
        res.status(500).send('Server error')
    }
});

module.exports = router;
