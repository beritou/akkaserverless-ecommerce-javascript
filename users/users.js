/**
 * Copyright 2021 Lightbend Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * This service uses the EventSourced state model in Akka Serverless.
 */
 import as from '@lightbend/akkaserverless-javascript-sdk';
 const EventSourced = as.EventSourced;
 
 /**
  * Create a new EventSourced entity with parameters
  * * An array of protobuf files where the entity can find message definitions
  * * The fully qualified name of the service that provides this entities interface
  */
const entity = new EventSourced(
    'users.proto',
    'ecommerce.Users',
    {
        // A persistence id for all value entities of this type. This will be prefixed onto 
        // the entityId when storing the state for this entity.
        entityType: 'users',
        
        // A snapshot will be persisted every time this many events are emitted.
        snapshotEvery: 100,
        
        // The directories to include when looking up imported protobuf files.
        includeDirs: ['./'],
        
        // Whether serialization of primitives should be supported when serializing events 
        // and snapshots.
        serializeAllowPrimitives: true,
        
        // Whether serialization should fallback to using JSON if the state can't be serialized 
        // as a protobuf.
        serializeFallbackToJson: true
    }
);

/**
 * Set a callback to create the initial state. This is what is created if there is no snapshot
 * to load, in other words when the entity is created and nothing else exists for it yet.
 *
 * The userID parameter can be ignored, it's the id of the entity which is automatically 
 * associated with all events and state for this entity.
 */
entity.setInitial(userID => ({}));

entity.setBehavior(users => {
    return {
        commandHandlers: {
            AddUser: addUser,
            GetUserDetails: getUserDetails,
            UpdateUserOrders: updateUserOrders,
        },
        eventHandlers: {
            UserCreated: userCreated,
            OrderAdded: orderAdded,
        }
    };
});

/**
 * The commandHandlers respond to requests coming in from the gRPC gateway.
 * They are responsible to make sure events are created that can be handled
 * to update the actual status of the entity.
**/

/**
 * addUser is the entry point for the API to create a new user. It logs the user
 * to be added to the system and emits a UserCreated event to add the user into
 * the system
 * 
 * @param {*} newUser the user to be added
 * @param {*} userInfo an empty placeholder
 * @param {*} ctx the Cloudstate context
 */
function addUser(newUser, userInfo, ctx) {
    console.log(`Creating a new user for ${newUser.id}`)
    ctx.emit({
        type: 'UserCreated',
        user: newUser
    });
    return newUser
}

/**
 * getUserDetails is the entry point for the API to get user details and returns the current
 * user data
 * 
 * @param {*} request contains the userID for which the request is made
 * @param {*} userInfo the user details (the entity) that contains user information for this request
 */
function getUserDetails(request, userInfo) {
    console.log(`Getting details for ${userInfo.id}`)
    return userInfo
}

/**
 * updateUserOrders is the entry point for the API to add a new order to a user. The message
 * contains the userID and orderID so that you can use that to get the order details from the order
 * service
 * 
 * @param {*} request  contains the userID and orderID
 * @param {*} userInfo  the user details (the entity) that contains user information for this request
 * @param {*} ctx the Cloudstate context
 */
function updateUserOrders(request, userInfo, ctx) {
    console.log(`Adding order ${request.orderID} to ${request.id}`)
    ctx.emit({
        type: 'OrderAdded',
        orderDetails: request
    });

    if(userInfo.orderID){
        userInfo.orderID.push(request.orderID)
    } else {
        userInfo.orderID = new Array(request.orderID)
    }
    
    return request
}

/** 
 * The eventHandlers respond to events emitted by the commandHandlers and manipulate
 * the actual state of the entities. The return items of these eventHandlers contain
 * the new state that subsequent messages will act on. 
**/

/**
 * userCreated reacts to the UserCreated events emitted by the addUser function and
 * adds the new user to the system
 * 
 * @param {*} newUser the user that is added to the system
 * @param {*} userInfo the placeholder that will be filled with the new user
 */
function userCreated(newUser, userInfo) {
    console.log(`Adding ${newUser.user.id} (${newUser.user.name}) to the system`)
    userInfo = newUser.user
    return userInfo
}

/**
 * orderAdded reacts to the OrderAdded events emitted by the updateUserOrders function
 * and adds a new orderID to the user
 * 
 * @param {*} orderInfo the order details to be be added
 * @param {*} userInfo the user to which the order should be added
 */
function orderAdded(orderInfo, userInfo) {
    console.log(`Updating orders for ${userInfo.id} to add ${orderInfo.orderDetails.orderID}`)

    if(userInfo.orderID){
        userInfo.orderID.push(orderInfo.orderDetails.orderID)
    } else {
        userInfo.orderID = new Array(orderInfo.orderDetails.orderID)
    }

    return userInfo
}

export default entity;