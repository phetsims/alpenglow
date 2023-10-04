
```mermaid
flowchart TD
    
    classDef default font-size:40px
    
    classDef outputClass stroke:#a00, font-size:40px
    classDef inputClass stroke:#0a0, font-size:40px
    classDef hideClass fill:transparent, stroke:transparent
    
    subgraph inputs [" "]
        inputChunks["inputChunks<br>RasterChunk[]"]:::inputClass
        inputEdges["inputEdges<br>RasterEdge[]"]:::inputClass
    end
    class inputs hideClass

    inputChunks --> InitialChunk([InitialChunk])
    InitialChunk --> clippedChunks0

    subgraph clippedChunks [" "]
        clippedChunks0["clippedChunks (no area data)<br>RasterClippedChunk[]"]
        clippedChunks1["clippedChunks (partial data)<br>RasterClippedChunk[]"]
        clippedChunks2["clippedChunks (partial data)<br>RasterClippedChunk[]"]
        clippedChunks3["clippedChunks (FULL data)<br>RasterClippedChunk[]"]
    end

    inputChunks & inputEdges & clippedChunks0 --> InitialClip([InitialClip])
    InitialClip --> clippedChunks1 & reduces0 & edgeClips

    clippedChunks1 & reduces0 --> ChunkReduce1([ChunkReduce]) --> reduces1 & clippedChunks2
    
    clippedChunks2 & reduces1 --> ChunkReduce2([ChunkReduce]) --> reduces2 & clippedChunks3

    clippedChunks3 & edgeClips --> InitialEdgeReduce([InitialEdgeReduce]) --> edgeReduces0reduce

    edgeReduces0reduce --> EdgeReduce1 --> edgeReduces0scan & edgeReduces1reduce

    edgeReduces1reduce --> EdgeReduce2 --> edgeReduces1scan & edgeReduces2reduce

    reduces0["reduces0<br>RasterChunkReduceQuad[]"]
    reduces1["reduces1<br>RasterChunkReduceQuad[]"]
    reduces2["reduces2<br>RasterChunkReduceQuad[]"]

    subgraph edgeCounts [" "]
        reducibleEdgeCount["reducibleEdgeCount<br>number"]:::outputClass
        completeEdgeCount["completeEdgeCount<br>number"]:::outputClass
    end
    class edgeCounts hideClass

    edgeReduces2reduce --> reducibleEdgeCount & completeEdgeCount

    clippedChunks3 & edgeReduces0scan & edgeReduces1scan & edgeReduces2reduce & edgeClips --> EdgeScan([EdgeScan])
    EdgeScan --> reducibleEdges0
    EdgeScan --> completeEdges
    EdgeScan --> chunkIndices["chunkIndices<br>number[]<br>Maps clippedChunk index<br>to output chunk index"]

    chunkIndices & reducibleEdgeCount & reducibleEdges0 --> EdgeIndexPatch([EdgeIndexPatch]) --> reducibleEdges1

    clippedChunks3 --> InitialSplitReduce --> splitReduces0reduce
    splitReduces0reduce --> EdgeReduceX --> splitReduces0scan & splitReduces1reduce
    splitReduces1reduce --> EdgeReduceY --> splitReduces1scan & splitReduces2

    subgraph splits [" "]
        InitialSplitReduce([InitialSplitReduce])
    
        subgraph splitReduces0 [" "]
            splitReduces0reduce["splitReduces0 (reduced)<br>RasterSplitReduceData[]"]
            splitReduces0scan["splitReduces0 (scanned)<br>RasterSplitReduceData[]"]
        end
    
        subgraph splitReduces1 [" "]
            splitReduces1reduce["splitReduces1 (reduced)<br>RasterSplitReduceData[]"]
            splitReduces1scan["splitReduces1 (scanned)<br>RasterSplitReduceData[]"]
        end
        
        splitReduces2["splitReduces2<br>RasterSplitReduceData"]
        
        EdgeReduceX([EdgeReduce])
        EdgeReduceY([EdgeReduce])
    end
    class splits hideClass
    
    subgraph chunkCounts [" "]
        reducibleChunkCount["reducibleChunkCount<br>number"]:::outputClass
        completeChunkCount["completeChunkCount<br>number"]:::outputClass
    end
    class chunkCounts hideClass

    splitReduces2 --> reducibleChunkCount & completeChunkCount

    splitReduces2 & splitReduces1scan & splitReduces0scan & clippedChunks3 --> SplitScan([SplitScan])
    SplitScan --> reducibleChunks0
    SplitScan --> completeChunks0
    SplitScan --> chunkIndexMap["chunkIndexMap<br>number[]<br>Stores edge start/end indices"]

    reducibleChunks0 & completeChunks0 & chunkIndexMap & chunkIndices & clippedChunks3 --> ChunkIndexPatch([ChunkIndexPatch])
    ChunkIndexPatch --> reducibleChunks1:::outputClass & completeChunks1:::outputClass

    subgraph edges [" "]
        subgraph edgeReduces0 [" "]
            edgeReduces0reduce["edgeReduces0 (reduced)<br>RasterSplitReduceData[]"]
            edgeReduces0scan["edgeReduces0 (scanned)<br>RasterSplitReduceData[]"]
        end
        
        EdgeReduce1([EdgeReduce])
    
        subgraph edgeReduces1 [" "]
            edgeReduces1reduce["edgeReduces1 (reduced)<br>RasterSplitReduceData[]"]
            edgeReduces1scan["edgeReduces1 (scanned)<br>RasterSplitReduceData[]"]
        end
        
        EdgeReduce2([EdgeReduce])
        
        edgeReduces2reduce["edgeReduces2 (reduced)<br>RasterSplitReduceData[]"]
    end
    class edges hideClass
    
    subgraph outputEdges [" "]
        subgraph reducibleEdges [" "]
            reducibleEdges0["reducibleEdges (unmapped)<br>RasterEdge[]"]
            reducibleEdges1["reducibleEdges<br>RasterEdge[]"]:::outputClass
        end
        
        completeEdges["completeEdges<br>RasterCompleteEdge[]"]:::outputClass
    end
    class outputEdges hideClass

    subgraph reducibleChunks [" "]
        reducibleChunks0["reducibleChunks (no indices)<br>RasterChunk[]"]
        reducibleChunks1["reducibleChunks<br>RasterChunk[]"]
    end

    subgraph completeChunks [" "]
        completeChunks0["completeChunks (no indices)<br>RasterCompleteChunk[]"]
        completeChunks1["completeChunks<br>RasterCompleteChunk[]"]
    end
    
%%    subgraph outputs [" "]
%%        reducibleEdgeCount
%%        completeEdgeCount
%%        reducibleChunkCount
%%        completeChunkCount
%%        reducibleEdges1
%%        completeEdges
%%        reducibleChunks1
%%        completeChunks1
%%    end
%%    style outputs fill:transparent,stroke:transparent
```
