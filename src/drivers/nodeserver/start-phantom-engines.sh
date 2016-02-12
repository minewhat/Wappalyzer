#!/bin/bash

echo "Starting the phantom engines on 10 ports ranging from 3101 to 3110\n";
for i in {3101..3110};
	do
	forever -o log/access-$i.log -e log/error-$i.log start ./engine.js $i &
	disown
done
