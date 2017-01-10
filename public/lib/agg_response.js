define(function (require) {
  return function sankeyProvider(Private, Notifier) {
    var _ = require('lodash');
    var arrayToLinkedList = require('ui/agg_response/hierarchical/_array_to_linked_list');
    var notify = new Notifier({
      location: 'Sankey chart response converter'
    });
    var nodes = {};
    var links = {};
    var lastNode = -1;

    function processEntry(aggConfig, metric, aggData, prevNode) {
      _.each(aggData.buckets, function (b) {
        var bkey = aggConfig.fieldFormatter()(b.key);
        if (isNaN(nodes[bkey])) {
          nodes[bkey] = lastNode + 1;
          lastNode = _.max(_.values(nodes));
        }
        if (aggConfig._previous) {
          var k = prevNode + 'sankeysplitchar' + nodes[bkey];
          if (isNaN(links[k])) {
            links[k] = metric.getValue(b);
          } else {
            links[k] += metric.getValue(b);
          }
        }
        if (aggConfig._next) {
          processEntry(aggConfig._next, metric, b[aggConfig._next.id], nodes[bkey]);
        }
      });
    }

    return function (vis, resp) {

      var metric = vis.aggs.bySchemaGroup.metrics[0];
      var buckets = vis.aggs.bySchemaGroup.buckets;
      buckets = arrayToLinkedList(buckets);
      if (!buckets)  {
        return {'slices':{'nodes':[],'links':[]}};
      }

      var firstAgg = buckets[0];
      var aggData = resp.aggregations[firstAgg.id];

      if (!firstAgg._next) {
        notify.error('need more than one sub aggs');
      }

      // reset these three variables, so that everything is fresh for refresh
      nodes = {};
      links = {};
      lastNode = -1;
    
      processEntry(firstAgg, metric, aggData, -1);

      var invertNodes = _.invert(nodes);
      var chart = {
        'slices': {
          'nodes' : _.map(_.keys(invertNodes), function (k) { return {'name':invertNodes[k]}; }),
          'links' : _.map(_.keys(links), function (k) {
            var s = k.split('sankeysplitchar');
            return {'source': parseInt(s[0]), 'target': parseInt(s[1]), 'value': links[k]};
          })
        }
      };

      return chart;
    };
  };
});
