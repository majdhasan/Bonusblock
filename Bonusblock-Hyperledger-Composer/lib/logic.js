'use strict';

// The transaction logic of Bonusblock.io
/*
*  Manage Participants
*/
const factory = getFactory();
const namespace = 'de.bonusblock.io';


/**
 * Register a member
 * @param {de.bonusblock.io.RegisterMember}  register
 * @transaction
 */

async function registerMember(register) {  // eslint-disable-line no-unused-vars
    console.log('Register a Member');

    const factory = getFactory();
    const namespace = 'de.bonusblock.io';
  
  if(register.member.insurance==null){

    // Create a new relation between the insurance and the new memeber
     register.member.insurance = factory.newRelationship(namespace, 'Insurance', register.insurance.getIdentifier());

    // Update the change in the Person registry
    const personRegistry = await getParticipantRegistry(namespace + '.Person');
    await personRegistry.update(register.member);
    }
  else
  {
  throw new Error ('User is already a member of another insurance');
  }
}

/**
 * Unregister a member
 * @param {de.bonusblock.io.UnregisterMember}  unregister
 * @transaction
 */

async function unregisterMember(unregister) {  // eslint-disable-line no-unused-vars
    console.log('unRegisterMember');

    const factory = getFactory();
    const namespace = 'de.bonusblock.io';
  
  
	if(unregister.insurance.getIdentifier() === unregister.member.insurance.getIdentifier()){

          let member = unregister.member;
    member.insurance = null;

    const personRegistry = await getParticipantRegistry(namespace + '.Person');
    await personRegistry.update(member);
    }
  else
    {
     throw new Error('User is not a member of your insurance');
    }
}

/*
* Records/Rewards handling
*/

/**
 * Store a record
 * @param {de.bonusblock.io.StoreRecord}  recordData
 * @transaction
 */
async function storeRecord(recordData) {  // eslint-disable-line no-unused-vars
    
    console.log('Store a Record');

    const factory = getFactory();
    const namespace = 'de.bonusblock.io';

    //create a new record
    const Record = factory.newResource(namespace, 'Record' , recordData.recordID);
    Record.actor = factory.newRelationship(namespace, 'Person', recordData.actor.getIdentifier());
    Record.amount = recordData.amount;
    Record.value = recordData.value;
    Record.type = recordData.type;

    //save the new record to the registry
    const recordAssetRegistry = await getAssetRegistry(namespace + '.Record');
    await recordAssetRegistry.add(Record);

}

/**
 * Request a reward
 * @param {de.bonusblock.io.RequestReward}  requestData
 * @transaction
 */

async function requestReward(requestData) { 
    console.log('request a Reward');
    
    // Check if member is insured, if not throw an error
    if (requestData.member.insurance == null){
        
        throw new Error('Member is not registered for an insurance');
    }
    else{
    
    const factory = getFactory();
    const namespace = 'de.bonusblock.io';

     // count all members records which aren't rewarded yet and change state to Requested
    let requestedRewardAmount = 0;
    let numberofRecords = 0;

    let recordAssetRegistry = await getAssetRegistry(namespace+ '.Record');
    let recordAssetRegistryContent = await recordAssetRegistry.getAll();
	var personRecords=[];
    await recordAssetRegistryContent.forEach( await async function(eachRecord){
      	
        if (eachRecord.actor.getIdentifier() == requestData.member.getIdentifier() && eachRecord.status =='SAVED') {
          	personRecords.push(eachRecord);
            numberofRecords= numberofRecords+1;
            eachRecord.status = 'REQUESTED';
            requestedRewardAmount +=   (eachRecord.amount * eachRecord.value);
        }
        
      
    });  
      
      await recordAssetRegistry.updateAll(personRecords);
      
    // if member has no new records throw an error
    if (numberofRecords == 0)  {
        throw new Error('No new records to reward for the member');
    }
    else{

    //create a new reward request
    const Request = factory.newResource(namespace, 'RewardRequest' , requestData.RewardRequestID);
    Request.member = factory.newRelationship(namespace, 'Person', requestData.member.getIdentifier());
    Request.insurance = requestData.member.insurance;  
    Request.status = 'PENDING'; 
    Request.amount = requestedRewardAmount;
    
    //add the request to the registry
    let rewardRequestAssetRegistry = await getAssetRegistry(namespace + '.RewardRequest');
    await rewardRequestAssetRegistry.add(Request);

    // Emit an Event
    let requestEvent = getFactory().newEvent(namespace, 'RewardRequested');
    requestEvent.rewardID = requestData.RewardRequestID;
    requestEvent.person = factory.newRelationship(namespace, 'Person', requestData.member.getIdentifier());
    requestEvent.insurance = factory.newRelationship(namespace, 'Insurance', requestData.member.insurance.getIdentifier());
    emit(requestEvent);
}
}
}

/**
 * Reward a member
 * @param {de.bonusblock.io.RewardMember}  data
 * @transaction
 */

async function rewardMember(data) {  
    console.log('reward a Member');

    // Throw error if already rewarded 
    if (data.request.status == "ACCEPTED"){
        
        throw new Error('Request already rewarded');
    }
    else{
    const namespace = 'de.bonusblock.io';
    let request = data.request;
    let member = data.request.member;
    
    // change the status of the request to accepted
    data.request.status = 'ACCEPTED';

    let rewardRequestAssetRegistry = await getAssetRegistry(namespace + '.RewardRequest');
    await rewardRequestAssetRegistry.update(request);
    
    // Add the reward to the members account
    member.rewardAccount+=  data.request.amount;

    // update the data in the registry
    let personRegistry = await getParticipantRegistry(namespace + '.Person');
    await personRegistry.update(member);

}
}