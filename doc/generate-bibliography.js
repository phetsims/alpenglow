// Copyright 2023, University of Colorado Boulder

// Generates the bibliography for the Alpenglow documentation
// Run with `node js/generate-bibliography.js`

/* eslint-env node */

const Cite = require( 'citation-js' ); // eslint-disable-line require-statement-match
const fs = require( 'fs' );

( async () => {
  const links = {};
  const cite = new Cite();

  await cite.add( `@inproceedings{Soerjadi1968OnTC,
    title={On the Computation of the Moments of a Polygon, with some Applications},
    author={R. Soerjadi},
    year={1968},
    url={https://api.semanticscholar.org/CorpusID:118692250}
  }` );
  links.Soerjadi1968OnTC = 'https://repository.tudelft.nl/islandora/object/uuid%3A963296a1-8940-4439-9404-eca1bd2f8638';

  await cite.add( `@misc{levien2022fast,
    title={Fast GPU bounding boxes on tree-structured scenes}, 
    author={Raph Levien},
    year={2022},
    eprint={2205.11659},
    archivePrefix={arXiv},
    primaryClass={cs.GR}
  }` );
  links.levien2022fast = 'https://arxiv.org/pdf/2205.11659.pdf';

  await cite.add( `@book{agoston2005computer,
    title={Computer Graphics and Geometric Modelling},
    author={Agoston, M.K.},
    isbn={9781852338183},
    lccn={2004049155},
    series={Computer Graphics and Geometric Modeling},
    url={https://books.google.com/books?id=fGX8yC-4vXUC},
    year={2005},
    publisher={Springer}
  }` );
  links.agoston2005computer = 'https://books.google.com/books?id=fGX8yC-4vXUC';

  await cite.add( `@article{10.1145/130881.130894,
    author = {Maillot, Patrick-Gilles},
    title = {A New, Fast Method for 2D Polygon Clipping: Analysis and Software Implementation},
    year = {1992},
    issue_date = {July 1992},
    publisher = {Association for Computing Machinery},
    address = {New York, NY, USA},
    volume = {11},
    number = {3},
    issn = {0730-0301},
    url = {https://doi.org/10.1145/130881.130894},
    doi = {10.1145/130881.130894},
    abstract = {This paper presents a new 2D polygon clipping method, based on an extension to the Sutherland-Cohen 2D line clipping method. After discussing three basic polygon clipping algorithms, a different approach is proposed, explaining the principles of a new algorithm and presenting it step by step.An example implementation of the algorithm is given along with some results. A comparison between the proposed method, the Liang and Barsky algorithm, and the Sutherland-Hodgman algorithm is also given, showing performances up to eight times the speed of the Sutherland-Hodgman algorithm, and up to three times the Liang and Barsky algorithm. The algorithm proposed here can use floating point or integer operations; this can be useful for fast or simple implementations.},
    journal = {ACM Trans. Graph.},
    month = {jul},
    pages = {276–290},
    numpages = {15},
    keywords = {polygon clipping, clipping}
  }` );
  links[ '10.1145/130881.130894' ] = 'https://dl.acm.org/doi/10.1145/130881.130894';

  await cite.add( `@article{Matthes_2019,
    title={Another Simple but Faster Method for 2D Line Clipping},
    volume={9},
    ISSN={2231-3281},
    url={http://dx.doi.org/10.5121/ijcga.2019.9301},
    DOI={10.5121/ijcga.2019.9301},
    number={3},
    journal={International Journal of Computer Graphics &amp; Animation},
    publisher={Academy and Industry Research Collaboration Center (AIRCC)},
    author={Matthes, Dimitrios and Drakopoulos, Vasileios},
    year={2019},
    month=jul, pages={1–15} }
  ` );
  links.Matthes_2019 = 'https://aircconline.com/ijcga/V9N3/9319ijcga01.pdf';

  await cite.add( `@article{10.1145/129902.129906,
    author = {Vatti, Bala R.},
    title = {A Generic Solution to Polygon Clipping},
    year = {1992},
    issue_date = {July 1992},
    publisher = {Association for Computing Machinery},
    address = {New York, NY, USA},
    volume = {35},
    number = {7},
    issn = {0001-0782},
    url = {https://doi.org/10.1145/129902.129906},
    doi = {10.1145/129902.129906},
    journal = {Commun. ACM},
    month = {jul},
    pages = {56–63},
    numpages = {8},
    keywords = {difference, spatial coherence, scanbeam, unions, contributing edge, intersection, vertex classification, polygon clipping, trapezoids, successor edge, hidden surface, contributing local minimum, connectivity coherence}
  }` );
  links[ '10.1145/129902.129906' ] = 'https://dl.acm.org/doi/pdf/10.1145/129902.129906';

  await cite.add( `@book{bb5afff9714941c681fc0e5270168a71,
    title = "Programming Massively Parallel Processors: A Hands-on Approach, Fourth Edition",
    abstract = "Programming Massively Parallel Processors: A Hands-on Approach shows both student and professional alike the basic concepts of parallel programming and GPU architecture. Various techniques for constructing parallel programs are explored in detail. Case studies demonstrate the development process, which begins with computational thinking and ends with effective and efficient parallel programs. Topics of performance, floating-point format, parallel patterns, and dynamic parallelism are covered in depth.  For this new edition, the authors are updating their coverage of CUDA, including the concept of unified memory, and expanding content in areas such as threads, while still retaining its concise, intuitive, practical approach based on years of road-testing in the authors' own parallel computing courses.",
    author = "Hwu, {Wen mei W.} and Kirk, {David B.} and Hajj, {Izzat El}",
    note = "Publisher Copyright: {\textcopyright} 2023 Elsevier Inc. All rights reserved.",
    year = "2022",
    month = jan,
    day = "1",
    doi = "10.1016/C2020-0-02969-5",
    language = "English (US)",
    isbn = "9780323984638",
    publisher = "Elsevier",
  }` );
  links.bb5afff9714941c681fc0e5270168a71 = 'https://shop.elsevier.com/books/programming-massively-parallel-processors/hwu/978-0-323-91231-0';

  await cite.add( `@article{10.1145/7902.7903,
    author = {Hillis, W. Daniel and Steele, Guy L.},
    title = {Data Parallel Algorithms},
    year = {1986},
    issue_date = {Dec. 1986},
    publisher = {Association for Computing Machinery},
    address = {New York, NY, USA},
    volume = {29},
    number = {12},
    issn = {0001-0782},
    url = {https://doi.org/10.1145/7902.7903},
    doi = {10.1145/7902.7903},
    abstract = {Parallel computers with tens of thousands of processors are typically programmed in a data parallel style, as opposed to the control parallel style used in multiprocessing. The success of data parallel algorithms—even on problems that at first glance seem inherently serial—suggests that this style of programming has much wider applicability than was previously thought.},
    journal = {Commun. ACM},
    month = {dec},
    pages = {1170–1183},
    numpages = {14}
  }` );
  links[ '10.1145/7902.7903' ] = 'http://cva.stanford.edu/classes/cs99s/papers/hillis-steele-data-parallel-algorithms.pdf';

  await cite.add( `@INPROCEEDINGS{223009,
    author={Blelloch, G.E. and Chatterjee, S. and Zagha, M.},
    booktitle={Proceedings Sixth International Parallel Processing Symposium}, 
    title={Solving linear recurrences with loop raking}, 
    year={1992},
    volume={},
    number={},
    pages={416-424},
    doi={10.1109/IPPS.1992.223009}
  }` );
  links[ '223009' ] = 'https://ieeexplore.ieee.org/document/223009';

  // https://kieber-emmons.medium.com/optimizing-parallel-reduction-in-metal-for-apple-m1-8e8677b49b01
  // https://kieber-emmons.medium.com/efficient-parallel-prefix-sum-in-metal-for-apple-m1-9e60b974d62
  // https://kieber-emmons.medium.com/memory-bandwidth-optimized-parallel-radix-sort-in-metal-for-apple-m1-and-beyond-4f4590cfd5d3
  await cite.add( `@online{KieberEmmonsReduce,
    author = {Kieber-Emmons, Matthew},
    title = {Optimizing Parallel Reduction in Metal for Apple M1},
    year = {2021},
    url = {https://kieber-emmons.medium.com/optimizing-parallel-reduction-in-metal-for-apple-m1-8e8677b49b01},
    urldate = {2023-11-28}
  }` );
  links.KieberEmmonsReduce = 'https://kieber-emmons.medium.com/optimizing-parallel-reduction-in-metal-for-apple-m1-8e8677b49b01';

  await cite.add( `@online{KieberEmmonsPrefixSum,
    author = {Kieber-Emmons, Matthew},
    title = {Efficient Parallel Prefix Sum in Metal for Apple M1},
    year = {2021},
    url = {https://kieber-emmons.medium.com/efficient-parallel-prefix-sum-in-metal-for-apple-m1-9e60b974d62},
    urldate = {2023-11-28}
  }` );
  links.KieberEmmonsPrefixSum = 'https://kieber-emmons.medium.com/efficient-parallel-prefix-sum-in-metal-for-apple-m1-9e60b974d62';

  await cite.add( `@online{KieberEmmonsRadixSort,
    author = {Kieber-Emmons, Matthew},
    title = {Memory Bandwidth Optimized Parallel Radix Sort in Metal for Apple M1 and Beyond},
    year = {2022},
    url = {https://kieber-emmons.medium.com/memory-bandwidth-optimized-parallel-radix-sort-in-metal-for-apple-m1-and-beyond-4f4590cfd5d3},
    urldate = {2023-11-28}
  }` );
  links.KieberEmmonsRadixSort = 'https://kieber-emmons.medium.com/memory-bandwidth-optimized-parallel-radix-sort-in-metal-for-apple-m1-and-beyond-4f4590cfd5d3';

  await cite.add( `@online{LevienPrefixSumVulkan,
    author = {Levien, Raph},
    title = {Prefix sum on Vulkan},
    year = {2020},
    url = {https://raphlinus.github.io/gpu/2020/04/30/prefix-sum.html},
    urldate = {2023-11-28}
  }` );
  links.LevienPrefixSumVulkan = 'https://raphlinus.github.io/gpu/2020/04/30/prefix-sum.html';

  await cite.add( `@online{DrangGreens,
    author = {Drang},
    title = {Green’s theorem and section properties},
    year = {2018},
    url = {https://leancrew.com/all-this/2018/01/greens-theorem-and-section-properties/},
    urldate = {2023-11-28}
  }` );
  links.DrangGreens = 'https://leancrew.com/all-this/2018/01/greens-theorem-and-section-properties/';

  await cite.add( `@article{10.1145/1963190.2025380,
    author = {Haverkort, Herman and Walderveen, Freek V.},
    title = {Four-Dimensional Hilbert Curves for R-Trees},
    year = {2008},
    issue_date = {2011},
    publisher = {Association for Computing Machinery},
    address = {New York, NY, USA},
    volume = {16},
    issn = {1084-6654},
    url = {https://doi.org/10.1145/1963190.2025380},
    doi = {10.1145/1963190.2025380},
    abstract = {Two-dimensional R-trees are a class of spatial index structures in which objects are arranged to enable fast window queries: report all objects that intersect a given query window. One of the most successful methods of arranging the objects in the index structure is based on sorting the objects according to the positions of their centers along a two-dimensional Hilbert space-filling curve. Alternatively, one may use the coordinates of the objects' bounding boxes to represent each object by a four-dimensional point, and sort these points along a four-dimensional Hilbert-type curve. In experiments by Kamel and Faloutsos and by Arge et al., the first solution consistently outperformed the latter when applied to point data, while the latter solution clearly outperformed the first on certain artificial rectangle data. These authors did not specify which four-dimensional Hilbert-type curve was used; many exist.In this article, we show that the results of the previous articles can be explained by the choice of the four-dimensional Hilbert-type curve that was used and by the way it was rotated in four-dimensional space. By selecting a curve that has certain properties and choosing the right rotation, one can combine the strengths of the two-dimensional and the four-dimensional approach into one, while avoiding their apparent weaknesses. The effectiveness of our approach is demonstrated with experiments on various datasets. For real data taken from VLSI design, our new curve yields R-trees with query times that are better than those of R-trees that were obtained with previously used curves.},
    journal = {ACM J. Exp. Algorithmics},
    month = {nov},
    articleno = {3.4},
    numpages = {19},
    keywords = {R-trees, space-filling curves, spatial data structures}
  }` );
  links[ '10.1145/1963190.2025380' ] = 'https://dl.acm.org/doi/abs/10.1145/1963190.2025380';

  await cite.add( `@Inbook{Bader2013,
    author="Bader, Michael",
    title="Space-Filling Curves in 3D",
    bookTitle="Space-Filling Curves: An Introduction with Applications in Scientific Computing",
    year="2013",
    publisher="Springer Berlin Heidelberg",
    address="Berlin, Heidelberg",
    pages="109--127",
    abstract="To construct a three-dimensional Hilbert curve, we want to retain the characteristic properties of the 2D Hilbert curve in 3D.",
    isbn="978-3-642-31046-1",
    doi="10.1007/978-3-642-31046-1_8",
    url="https://doi.org/10.1007/978-3-642-31046-1_8"
  }` );
  links.Bader2013 = 'https://link.springer.com/chapter/10.1007/978-3-642-31046-1_8';

  await cite.add( `@article{10.1145/1409060.1409088,
    author = {Nehab, Diego and Hoppe, Hugues},
    title = {Random-Access Rendering of General Vector Graphics},
    year = {2008},
    issue_date = {December 2008},
    publisher = {Association for Computing Machinery},
    address = {New York, NY, USA},
    volume = {27},
    number = {5},
    issn = {0730-0301},
    url = {https://doi.org/10.1145/1409060.1409088},
    doi = {10.1145/1409060.1409088},
    abstract = {We introduce a novel representation for random-access rendering of antialiased vector graphics on the GPU, along with efficient encoding and rendering algorithms. The representation supports a broad class of vector primitives, including multiple layers of semitransparent filled and stroked shapes, with quadratic outlines and color gradients. Our approach is to create a coarse lattice in which each cell contains a variable-length encoding of the graphics primitives it overlaps. These cell-specialized encodings are interpreted at runtime within a pixel shader. Advantages include localized memory access and the ability to map vector graphics onto arbitrary surfaces, or under arbitrary deformations. Most importantly, we perform both prefiltering and supersampling within a single pixel shader invocation, achieving inter-primitive antialiasing at no added memory bandwidth cost. We present an efficient encoding algorithm, and demonstrate high-quality real-time rendering of complex, real-world examples.},
    journal = {ACM Trans. Graph.},
    month = {dec},
    articleno = {135},
    numpages = {10}
  }` );
  links[ '10.1145/1409060.1409088' ] = 'https://hhoppe.com/ravg.pdf';

  await cite.add( `@inproceedings{10.1145/2018323.2018337,
    author = {Laine, Samuli and Karras, Tero},
    title = {High-Performance Software Rasterization on GPUs},
    year = {2011},
    isbn = {9781450308960},
    publisher = {Association for Computing Machinery},
    address = {New York, NY, USA},
    url = {https://doi.org/10.1145/2018323.2018337},
    doi = {10.1145/2018323.2018337},
    abstract = {In this paper, we implement an efficient, completely software-based graphics pipeline on a GPU. Unlike previous approaches, we obey ordering constraints imposed by current graphics APIs, guarantee hole-free rasterization, and support multisample antialiasing. Our goal is to examine the performance implications of not exploiting the fixed-function graphics pipeline, and to discern which additional hardware support would benefit software-based graphics the most.We present significant improvements over previous work in terms of scalability, performance, and capabilities. Our pipeline is malleable and easy to extend, and we demonstrate that in a wide variety of test cases its performance is within a factor of 2--8x compared to the hardware graphics pipeline on a top of the line GPU.Our implementation is open sourced and available at http://code.google.com/p/cudaraster/},
    booktitle = {Proceedings of the ACM SIGGRAPH Symposium on High Performance Graphics},
    pages = {79–88},
    numpages = {10},
    location = {Vancouver, British Columbia, Canada},
    series = {HPG '11}
  }` );
  links[ '10.1145/2018323.2018337' ] = 'https://research.nvidia.com/sites/default/files/pubs/2011-08_High-Performance-Software-Rasterization/laine2011hpg_paper.pdf';

  await cite.add( `@article{10.1145/2661229.2661274,
    author = {Ganacim, Francisco and Lima, Rodolfo S. and de Figueiredo, Luiz Henrique and Nehab, Diego},
    title = {Massively-Parallel Vector Graphics},
    year = {2014},
    issue_date = {November 2014},
    publisher = {Association for Computing Machinery},
    address = {New York, NY, USA},
    volume = {33},
    number = {6},
    issn = {0730-0301},
    url = {https://doi.org/10.1145/2661229.2661274},
    doi = {10.1145/2661229.2661274},
    abstract = {We present a massively parallel vector graphics rendering pipeline that is divided into two components. The preprocessing component builds a novel adaptive acceleration data structure, the shortcut tree. Tree construction is efficient and parallel at the segment level, enabling dynamic vector graphics. The tree allows efficient random access to the color of individual samples, so the graphics can be warped for special effects. The rendering component processes all samples and pixels in parallel. It was optimized for wide antialiasing filters and a large number of samples per pixel to generate sharp, noise-free images. Our sample scheduler allows pixels with overlapping antialiasing filters to share samples. It groups together samples that can be computed with the same vector operations using little memory or bandwidth. The pipeline is feature-rich, supporting multiple layers of filled paths, each defined by curved outlines (with linear, rational quadratic, and integral cubic B\\'{e}zier segments), clipped against other paths, and painted with semi-transparent colors, gradients, or textures. We demonstrate renderings of complex vector graphics in state-of-the-art quality and performance. Finally, we provide full source-code for our implementation as well as the input data used in the paper.},
    journal = {ACM Trans. Graph.},
    month = {nov},
    articleno = {229},
    numpages = {14},
    keywords = {vector graphics, parallel processing, rendering}
  }` );
  links[ '10.1145/2661229.2661274' ] = 'https://w3.impa.br/~diego/publications/GanEtAl14.pdf';

  await cite.add( `@inproceedings{10.1145/800248.807360,
    author = {Catmull, Edwin},
    title = {A Hidden-Surface Algorithm with Anti-Aliasing},
    year = {1978},
    isbn = {9781450379083},
    publisher = {Association for Computing Machinery},
    address = {New York, NY, USA},
    url = {https://doi.org/10.1145/800248.807360},
    doi = {10.1145/800248.807360},
    abstract = {In recent years we have gained understanding about aliasing in computer generated pictures and about methods for reducing the symptoms of aliasing. The chief symptoms are staircasing along edges and objects that pop on and off in time. The method for reducing these symptoms is to filter the image before sampling at the display resolution. One filter that is easy to understand and that works quite effectively is equivalent to integrating the visible intensities over the area that the pixel covers. There have been several implementations of this method - mostly unpublished - however most algorithms break down when the data for the pixel is complicated. Unfortunately, as the quality of displays and the complexity of pictures increase, the small errors that can occur in a single pixel become quite noticeable. A correct solution for this filter requires a hidden-surface algorithm at each pixel! If the data at the pixel is presented as a depth-ordered list of polygons then the average visible intensity can be found using a polygon clipper in a way similar to that employed by two known hidden-surface algorithms. All of the polygons in a pixel are clipped against some front unclipped edge into two lists of polygons. The algorithm is recursively entered with each new list and halts when the front polygon is clipped on all sides, thereby obscuring the polygons behind. The area weighted colors are then returned as the value to be added to the other pieces in the pixel.},
    booktitle = {Proceedings of the 5th Annual Conference on Computer Graphics and Interactive Techniques},
    pages = {6–11},
    numpages = {6},
    keywords = {Sampling, Aliasing, Computer graphics, Clipping, Hidden-surface removal, Filtering},
    series = {SIGGRAPH '78}
    }
  }` );
  links[ '10.1145/800248.807360' ] = 'https://dl.acm.org/doi/abs/10.1145/800248.807360';

  await cite.add( `@article{doi:10.1080/2151237X.2005.10129191,
    author = {Zhouchen Lin, Hai-Tao Chen, Heung-Yeung Shum and Jian Wang},
    title = {Optimal Polynomial Filters},
    journal = {Journal of Graphics Tools},
    volume = {10},
    number = {1},
    pages = {27-38},
    year = {2005},
    publisher = {Taylor & Francis},
    doi = {10.1080/2151237X.2005.10129191},
    URL = {https://doi.org/10.1080/2151237X.2005.10129191},
    eprint = {https://doi.org/10.1080/2151237X.2005.10129191}
  }` );
  links[ 'doi:10.1080/2151237X.2005.10129191' ] = 'https://zhouchenlin.github.io/Publications/2005-JGT-Filter.pdf';

  await cite.add( `@article{doi:10.1080/2151237X.2005.10129189,
    author = {Zhouchen Lin, Hai-Tao Chen, Heung-Yeung Shum and Jian Wang},
    title = {Prefiltering Two-Dimensional Polygons without Clipping},
    journal = {Journal of Graphics Tools},
    volume = {10},
    number = {1},
    pages = {17-26},
    year = {2005},
    publisher = {Taylor & Francis},
    doi = {10.1080/2151237X.2005.10129189},
    URL = {https://doi.org/10.1080/2151237X.2005.10129189},
    eprint = {https://doi.org/10.1080/2151237X.2005.10129189}
  }` );
  links[ 'doi:10.1080/2151237X.2005.10129189' ] = 'https://zhouchenlin.github.io/Publications/2005-JGT-Render.pdf';

  await cite.add( `@article {10.1111:cgf.12070,
    journal = {Computer Graphics Forum},
    title = {{Analytic Rasterization of Curves with Polynomial Filters}},
    author = {Manson, Josiah and Schaefer, Scott},
    year = {2013},
    publisher = {The Eurographics Association and Blackwell Publishing Ltd.},
    ISSN = {1467-8659},
    DOI = {10.1111/cgf.12070}
  }` );
  links[ '10.1111:cgf.12070' ] = 'https://people.engr.tamu.edu/schaefer/research/scanline.pdf';

  await cite.add( `@incollection{BELL2012359,
    title = {Chapter 26 - Thrust: A Productivity-Oriented Library for CUDA},
    editor = {Wen-mei W. Hwu},
    booktitle = {GPU Computing Gems Jade Edition},
    publisher = {Morgan Kaufmann},
    address = {Boston},
    pages = {359-371},
    year = {2012},
    series = {Applications of GPU Computing Series},
    isbn = {978-0-12-385963-1},
    doi = {https://doi.org/10.1016/B978-0-12-385963-1.00026-5},
    url = {https://www.sciencedirect.com/science/article/pii/B9780123859631000265},
    author = {Nathan Bell and Jared Hoberock},
    abstract = {Publisher Summary
    This chapter demonstrates how to leverage the Thrust parallel template library to implement high performance applications with minimal programming effort. With the introduction of CUDA C/C++, developers can harness the massive parallelism of the graphics processing unit (GPU) through a standard programming language. CUDA allows developers to make fine-grained decisions about how computations are decomposed into parallel threads and executed on the device. The level of control offered by CUDA C/C++ is an important feature; it facilitates the development of high-performance algorithms for a variety of computationally demanding tasks which merit significant optimization and profit from low-level control of the mapping onto hardware. With Thrust, developers describe their computation using a collection of high-level algorithms and completely delegate the decision of how to implement the computation to the library. Thrust is implemented entirely within CUDA C/C++ and maintains interoperability with the rest of the CUDA ecosystem. Interoperability is an important feature because no single language or library is the best tool for every problem. Thrust presents a style of programming emphasizing genericity and composability. Indeed, the vast majority of Thrust's functionality is derived from four fundamental parallel algorithms—for each, reduce, scan, and sort. Thrust's high-level algorithms enhance programmer productivity by automating the mapping of computational tasks onto the GPU. Thrust also boosts programmer productivity by providing a rich set of algorithms for common patterns.}
  }` );
  links.BELL2012359 = 'https://research.nvidia.com/publication/2011-10_thrust-productivity-oriented-library-cuda';

  await cite.add( `@article{KilgardBolz2012,
    author  = {Mark Kilgard and Jeff Bolz},
    title   = {GPU-accelerated Path Rendering},
    journal = {ACM Transactions on Graphics (Proceedings of SIGGRAPH Asia 2012)},
    year    = {2012},
    volume  = {31},
    number  = {6},
    month   = {Nov.},
    pages   = {to appear},
  }` );
  links.KilgardBolz2012 = 'https://developer.nvidia.com/gpu-accelerated-path-rendering';

  await cite.add( `@book{Wildberger2005,
    author = {Wildberger, Norman},
    year = {2005},
    month = {10},
    pages = {},
    title = {Divine Proportions: Rational Trigonometry to Universal geometry},
    isbn = {0-9757492-0-X}
  }` );
  links.Wildberger2005 = 'http://www.ms.lt/derlius/WildbergerDivineProportions.pdf';

  await cite.add( `@article {GPUpathtracingSA16,
    title = {Efficient GPU Path Rendering Using Scanline Rasterization},
    author = {Rui Li and Qiming Hou and Kun Zhou},
    journal = {ACM Transactions on Graphics},
    volume = {35},
    number = {6},
    year = {2016}
  }` );
  links.GPUpathtracingSA16 = 'http://kunzhou.net/zjugaps/pathrendering/';

  await cite.add( `@inproceedings{loop2005resolution,
    author = {Loop, Charles and Blinn, Jim},
    title = {Resolution Independent Curve Rendering using Programmable Graphics Hardware},
    booktitle = {July 2005 Transactions on Graphics (TOG) - (Siggraph 2005)},
    year = {2005},
    month = {January},
    abstract = {We present a method for resolution independent rendering of paths and bounded regions, defined by quadratic and cubic spline curves, that leverages the parallelism of programmable graphics hardware to achieve high performance. A simple implicit equation for a parametric curve is found in a space that can be thought of as an analog to texture space. The image of a curve’s B'ezier control points are found in this space and assigned to the control points as texture coordinates. When the triangle(s) corresponding to the B'ezier curve control hull are rendered, a pixel shader program evaluates the implicit equation for a pixel’s interpolated texture coordinates to determine an inside/outside test for the curve. We extend our technique to handle anti-aliasing of boundaries. We also construct a vector image from mosaics of triangulated B'ezier control points and show how to deform such images to create resolution independent texture on three dimensional objects.},
    publisher = {Association for Computing Machinery, Inc.},
    url = {https://www.microsoft.com/en-us/research/publication/resolution-independent-curve-rendering-using-programmable-graphics-hardware/},
    journal = {24/3},
    edition = {July 2005 Transactions on Graphics (TOG) - (Siggraph 2005)}
  }` );
  links.loop2005resolution = 'https://www.microsoft.com/en-us/research/wp-content/uploads/2005/01/p1000-loop.pdf';

  await cite.add( `@article{Lengyel2017FontRendering,
    author =       {Eric Lengyel},
    title =        {GPU-Centered Font Rendering Directly from Glyph
                    Outlines},
    year =         2017,
    month =        {June},
    day =          14,
    journal =      {Journal of Computer Graphics Techniques (JCGT)},
    volume =       6,
    number =       2,
    pages =        {31--47},
    url =          {http://jcgt.org/published/0006/02/02/},
    issn =         {2331-7418}
  }` );
  links.Lengyel2017FontRendering = 'https://jcgt.org/published/0006/02/02/';

  await cite.add( `@inproceedings{10.1145/1281500.1281665,
    author = {Green, Chris},
    title = {Improved Alpha-Tested Magnification for Vector Textures and Special Effects},
    year = {2007},
    isbn = {9781450318235},
    publisher = {Association for Computing Machinery},
    address = {New York, NY, USA},
    url = {https://doi.org/10.1145/1281500.1281665},
    doi = {10.1145/1281500.1281665},
    abstract = {A simple and efficient method is presented which allows improved rendering of glyphs composed of curved and linear elements. A distance field is generated from a high resolution image, and then stored into a channel of a lower-resolution texture. In the simplest case, this texture can then be rendered simply by using the alpha-testing and alpha-thresholding feature of modern GPUs, without a custom shader. This allows the technique to be used on even the lowest-end 3D graphics hardware.With the use of programmable shading, the technique is extended to perform various special effect renderings, including soft edges, outlining, drop shadows, multi-colored images, and sharp corners.},
    booktitle = {ACM SIGGRAPH 2007 Courses},
    pages = {9–18},
    numpages = {10},
    location = {San Diego, California},
    series = {SIGGRAPH '07}
  }` );
  links[ '10.1145/1281500.1281665' ] = 'https://steamcdn-a.akamaihd.net/apps/valve/2007/SIGGRAPH2007_AlphaTestedMagnification.pdf';

  await cite.add( `@mastersthesis{MCDF,
    author = {Viktor Chlumský},
    title = {Shape Decomposition for Multi-channel Distance Fields},
    year = {2015}
  }` );
  links.MCDF = 'https://dspace.cvut.cz/bitstream/handle/10467/62770/F8-DP-2015-Chlumsky-Viktor-thesis.pdf';

  await cite.add( `@book{boissonnat1998algorithmic,
    title={Algorithmic Geometry},
    author={Boissonnat, J.D. and Yvinec, M.},
    isbn={9780521565295},
    lccn={97019739},
    url={https://books.google.com/books?id=Ax50ccq_kFAC},
    year={1998},
    publisher={Cambridge University Press}
  }
  ` );
  links.boissonnat1998algorithmic = 'https://www.amazon.com/Algorithmic-Geometry-Jean-Daniel-Boissonnat/dp/0521565294';

  await cite.add( `@Unpublished{Baxter:2016:M2,
    author        = {Baxter, Sean},
    title         = {moderngpu 2.0},
    note          = {\\url{https://github.com/moderngpu/moderngpu/wiki}},
    year          = {2016}
  }` );
  links[ 'Baxter:2016:M2' ] = 'https://github.com/moderngpu/moderngpu/wiki';

  await cite.add( `@article{10.1145/3197517.3201380,
    author = {He, Yong and Fatahalian, Kayvon and Foley, Tim},
    title = {Slang: Language Mechanisms for Extensible Real-Time Shading Systems},
    year = {2018},
    issue_date = {August 2018},
    publisher = {Association for Computing Machinery},
    address = {New York, NY, USA},
    volume = {37},
    number = {4},
    issn = {0730-0301},
    url = {https://doi.org/10.1145/3197517.3201380},
    doi = {10.1145/3197517.3201380},
    abstract = {Designers of real-time rendering engines must balance the conflicting goals of maintaining clear, extensible shading systems and achieving high rendering performance. In response, engine architects have established effective design patterns for authoring shading systems, and developed engine-specific code synthesis tools, ranging from preprocessor hacking to domain-specific shading languages, to productively implement these patterns. The problem is that proprietary tools add significant complexity to modern engines, lack advanced language features, and create additional challenges for learning and adoption. We argue that the advantages of engine-specific code generation tools can be achieved using the underlying GPU shading language directly, provided the shading language is extended with a small number of best-practice principles from modern, well-established programming languages. We identify that adding generics with interface constraints, associated types, and interface/structure extensions to existing C-like GPU shading languages enables real-time Tenderer developers to build shading systems that are extensible, maintainable, and execute efficiently on modern GPUs without the need for additional domain-specific tools. We embody these ideas in an extension of HLSL called Slang, and provide a reference design for a large, extensible shader library implemented using Slang's features. We rearchitect an open source Tenderer to use this library and Slang's compiler services, and demonstrate the resulting shading system is substantially simpler, easier to extend with new features, and achieves higher rendering performance than the original HLSL-based implementation.},
    journal = {ACM Trans. Graph.},
    month = {jul},
    articleno = {141},
    numpages = {13},
    keywords = {real-time rendering, shading languages}
  }` );
  links[ '10.1145/3197517.3201380' ] = 'http://graphics.cs.cmu.edu/projects/slang/he18_slang.pdf';

  await cite.add( `@article{bangaru2023slangd,
    title       = {SLANG.D: Fast, Modular and Differentiable Shader Programming},
    author      = {Bangaru, Sai and Wu, Lifan and Li, Tzu-Mao and Munkberg, Jacob and Bernstein, Gilbert and Ragan-Kelley, Jonathan and Durand, Fredo and Lefohn, Aaron and He, Yong},
    month       = {December},
    journal     = {ACM Transactions on Graphics (SIGGRAPH Asia)},
    year        = {2023},
    volume      = {42},
    number      = {6},
    pages       = {1--28},
    doi         = {10.1145/3618353},
  }` );
  links.bangaru2023slangd = 'https://research.nvidia.com/labs/rtr/publication/bangaru2023slangd/';

  const map = {};
  cite.getIds().forEach( id => {
    map[ id ] = {
      id: id,
      link: links[ id ] || null,
      citation: cite.format( 'citation', {
        template: 'apa',
        entry: id
      } )
    };
  } );
  fs.writeFileSync( 'doc/citations.js', `/* eslint-disable */\n// generated from generate-bibliography.js, do not manually modify.\nwindow.citations = ${JSON.stringify( {
    map: map,
    bibliography: cite.format( 'bibliography', {
      format: 'html',
      template: 'apa',
      lang: 'en-US',
      prepend: entry => {
        return `<div id="${entry.id}">${links[ entry.id ] ? `<a href="${links[ entry.id ]}">` : ''}`;
      },
      append: entry => {
        return `${links[ entry.id ] ? '</a>' : ''}</div>`;
      }
    } )
  } )};\n` );
} )();

