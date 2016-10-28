<% _.forEach(methods, function(method) {%>
  <%= method.description %>
  <%= method.factoryMethodName %>: function(<%= method.queryParameters %>) {
    return <%= app.module %>.<%= method.apiMethodName %>(<%= method.apiQueryParameters %>);
  }<%= method.separator %>
<% }); %>