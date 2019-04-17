if [ $# -eq 0 ]
then
  echo "Please provide the run number"
  echo "USAGE: ./run.sh x"
  exit 1
fi

mkdir -p results/run$1
outDir=results/run$1

for fileName in *.js; do
  echo "Running $fileName ..."
  for((i=100000; i<3800000; i+=100000)); do
    if [[ "$i" == "2500000" ]] || [[ "$i" == "2600000" ]] || [[ "$i" == "2700000" ]] || [[ "$i" == "3000000" ]]; then
    continue
    fi
    node --max-old-space-size=30720 $fileName $i | tee -a $outDir/$fileName;
  done
done

