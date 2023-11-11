// Copyright 2023, University of Colorado Boulder

/**
 * Support for adding in comments to the resulting generated shader code that won't get removed by
 * the typical process that removes comments. Useful for noting templates used, or really anything else that can
 * benefit from seeing debugging comments in the generated shader code.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

${template( str => `/` + `*** ` + str + ` ***` + `/` )}
