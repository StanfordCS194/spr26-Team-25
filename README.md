# Chronos

[Wiki](https://github.com/StanfordCS194/spr26-Team-25/wiki)  
[PRD](https://docs.google.com/document/d/1Y04F4c-h7e4pqLdvdaL0m4DO4NHyDxRAper2d9bAhHQ/edit?usp=sharing)  
Nestor
Adam
Andrew
Dante  


# Quechua Ingestion Pipeline

Pulls two public HuggingFace corpora (a Spanish↔Quechua parallel corpus and a Quechua monolingual corpus), cleans and tokenises the text, then extracts a structured lexicon: 
lemmas with frequency ranks, estimated CEFR difficulty, semantic field tags, and Spanish gloss candidates. Also exports aligned sentence pairs.                                                                                  
## Setup                                                                               
```                                                                              
pip install -r requirements.txt
```
Run:
```
python -m pipeline.run        # full run (~20 min, downloads ~500 MB on first run)
python -m pipeline.run --dev  # fast dev run (5K parallel / 10K mono sentences)
```
Output:
```                                                                                                                                                                                                                                                     
quechua/vocabulary/extracted/   # one JSON file per frequency band                                                                                 
quechua/examples/parallel.json  # aligned sentence pairs
pipeline/reports/               # run stats and filter counts 
  ```