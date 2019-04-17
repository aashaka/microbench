const asyncChunks = require('async-chunks');
const ethereumjs = require('merkle-patricia-tree');
const ethUtil = require('ethereumjs-util');
const rainblock = require('@rainblock/merkle-patricia-tree');
const utils = require('./utils');
const wait = require('wait-for-stuff');

const rmain = (state, batchOps) => {
  for (let i = 0; i < batchOps.length; i++) {
    state.get(batchOps[i].key);
  }
};

const emain = (state, batchOps) => {
  let flag = 0;
  for (let i = 0; i < batchOps.length; i++) {
    state.get(batchOps[i].key, (err, val) => {flag += 1});
  }
  wait.for.predicate(() => (flag === batchOps.length));
}

const rsetup = (state, batchOps) => {
  for (let i = 0; i < batchOps.length; i++) {
    state.put(batchOps[i].key, batchOps[i].val);
  }
}

const esetup = (state, batchOps) => {
  let flag = false;
  state.batch(batchOps, () => {flag = true});
  wait.for.predicate(() => flag); 
}

if (process.argv.length !== 3) {
  console.log("USAGE: node filename.js blockNum");
  process.exit(1);
}
const blockNum = parseInt(process.argv[2], 10);
const block = blockNum.toString();
const suite = utils.newBenchmark();
const batchOps = utils.readFixedFromDump(blockNum);
const rstate = new rainblock.MerklePatriciaTree();
const estate = new ethereumjs();
//utils.addTest(suite, 'RBC ' + block, rmain, rsetup, rstate, batchOps);
utils.addTest(suite, 'ETH ' + block, emain, esetup, estate, batchOps);
suite.run();
