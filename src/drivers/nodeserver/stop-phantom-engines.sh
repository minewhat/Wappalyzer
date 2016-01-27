#!/bin/bash

echo "Stopping the phantom engines on 10 ports ranging from 3101 to 3110\n"; 
for i in {3101..3110}; 
	do curl -i http://localhost:$i/close
done