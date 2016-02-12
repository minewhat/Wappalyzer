#!/bin/bash

for count in {1..10};
do
for p in {3101..3110};
do
 curl -i http://localhost:$p/processurl?url=http://teenapparels.com 2> $count.$p.log &
done
done
